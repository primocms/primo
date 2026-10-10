const CONTROL_URL = 'https://primo-hosting-control.fly.dev/ops/monitor';
const ALLOWED = new Set(['signup_worker_stale','provider_check_unhealthy','provider_credential_expiring','backups_disabled','control_backup_stale','billing_review_pending','billing_notification_pending','suspension_pending','customer_backup_stale','customer_domain_update_unhealthy','signup_needs_attention']);

async function boundedFetch(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try { return await fetch(url, {...options, redirect:'manual', signal:controller.signal}); }
  finally { clearTimeout(timer); }
}
function safeError(error, env) {
  let message = String(error.message || 'network_error');
  for (const name of ['MONITOR_TOKEN','RESEND_API_KEY','ADMIN_TOKEN']) {
    if (env[name]) message = message.split(env[name]).join('[redacted]');
  }
  return message.replace(/Bearer\s+\S+|[A-Za-z0-9_+/=-]{35,}/g, '[redacted]').slice(0,200);
}

// Require two observations before declaring an incident or recovery. Persist
// the incident ID before mailing so a lost response cannot duplicate an alert.
export function transition(previous, issues, now) {
  const state = {...previous, checkedAt: now, issues};
  if (issues.length) {
    state.failures = (previous.failures || 0) + 1;
    state.successes = 0;
    if (state.failures >= 2 && !state.incident) state.incident = now;
  } else {
    state.failures = 0;
    state.successes = (previous.successes || 0) + 1;
  }
  return state;
}
async function probe(env) {
  try {
    const response = await boundedFetch(CONTROL_URL, {headers: {Authorization:`Bearer ${env.MONITOR_TOKEN}`, 'User-Agent':'PrimoHostingMonitor/1.0'}});
    if (!response.ok) return {issues:['control_service_unavailable'], httpStatus:response.status};
    const body = await response.json();
    if (body.schema !== 1 || typeof body.ok !== 'boolean' || !Number.isSafeInteger(body.checked_at) || Math.abs(Date.now()/1000-body.checked_at) > 120 || !Array.isArray(body.issues) || body.issues.some(code=>!ALLOWED.has(code)) || body.ok !== (body.issues.length === 0)) return {issues:['invalid_monitor_response'],httpStatus:response.status};
    return {issues:[...new Set(body.issues)].sort(),httpStatus:response.status};
  } catch (error) { return {issues:['control_service_unavailable'],httpStatus:0,error:safeError(error,env)}; }
}
async function send(env, subject, text, key) {
  const response = await boundedFetch('https://api.resend.com/emails', {method:'POST', headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key, 'User-Agent':'PrimoHostingMonitor/1.0'}, body:JSON.stringify({from:env.FROM_EMAIL,to:[env.ALERT_EMAIL],subject,text})});
  if (!response.ok) throw new Error('monitor alert delivery failed');
}
export class MonitorState {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    if (request.method === 'GET') return Response.json((await this.ctx.storage.get('state')) || {checkedAt:0});
    return this.ctx.blockConcurrencyWhile(async () => {
      const previous = (await this.ctx.storage.get('state')) || {};
      const now = Math.floor(Date.now()/1000);
      const probeResult = await probe(this.env);
      const issues = probeResult.issues;
      const state = transition(previous, issues, now);
      state.version = this.env.SOURCE_VERSION;
      if (new URL(request.url).pathname === '/scheduled') state.lastScheduledAt = now;
      state.probeStatus = probeResult.httpStatus;
      state.probeError = probeResult.error || '';
      await this.ctx.storage.put('state', state);
      const reminder = state.incident && issues.length && state.failures >= 2 && (!state.lastAlert || state.lastAlert < now-86400);
      const recovery = state.incident && !issues.length && state.successes >= 2;
      try {
        if (reminder) {
          const day = Math.floor(now/86400);
          await send(this.env, 'Primo hosting needs attention', `The independent Cloudflare monitor detected: ${issues.join(', ')}.\n\nReview the private hosting status. Automatic provisioning or backups may need attention. Existing customer data is retained.`, `primo-monitor-${state.incident}-${day}`);
          state.lastAlert = now;
        } else if (recovery) {
          // If no incident email was delivered, recovery needs no email.
          if (state.lastAlert) await send(this.env, 'Primo hosting recovered', 'The independent monitor has observed two healthy checks. Hosting workers, backup freshness and provider credentials currently pass.', `primo-monitor-recovery-${state.incident}`);
          state.incident = 0; state.lastAlert = 0;
        }
        state.mailError = false;
        state.mailDiagnostic = '';
      } catch (error) {
        state.mailError = true;
        state.mailDiagnostic = safeError(error,this.env);
        console.error('Independent hosting alert delivery failed; retry on next check');
      }
      await this.ctx.storage.put('state', state);
      return Response.json(state);
    });
  }
}
export default {
  async scheduled(controller, env, ctx) {
    const stub = env.MONITOR_STATE.get(env.MONITOR_STATE.idFromName('hosting'));
    ctx.waitUntil(stub.fetch('https://monitor.internal/scheduled', {method:'POST'}).then(r=>{if(!r.ok) throw new Error('monitor check failed');}));
  },
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!env.ADMIN_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}` || !((request.method==='GET' && path==='/status') || (request.method==='POST' && path==='/check'))) return new Response('Not found', {status:404});
    const stub = env.MONITOR_STATE.get(env.MONITOR_STATE.idFromName('hosting'));
    const response = await stub.fetch('https://monitor.internal'+path, {method:request.method});
    return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
};
