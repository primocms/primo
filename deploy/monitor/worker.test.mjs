import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {MonitorState, transition} from './worker.mjs';

test('transient errors do not open an incident; two errors do; two recoveries close it', () => {
  let state = transition({}, ['control_service_unavailable'], 100);
  assert.equal(state.incident, undefined);
  state = transition(state, [], 101);
  state = transition(state, ['signup_worker_stale'], 102);
  assert.equal(state.incident, undefined);
  state = transition(state, ['signup_worker_stale'], 103);
  assert.equal(state.incident, 103);
  state = transition(state, [], 104);
  assert.equal(state.incident, 103);
  state = transition(state, [], 105);
  assert.equal(state.successes, 2);
});
test('durable dedupe, retry after mail failure, daily reminder and recovery', async () => {
  const realFetch = globalThis.fetch;
  let fail = true, mailFail = false, mails = [];
  const values = new Map();
  const ctx = {storage:{get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v))},blockConcurrencyWhile:fn=>fn()};
  const env = {MONITOR_TOKEN:'read-only',RESEND_API_KEY:'sending-only',FROM_EMAIL:'operator@example.com',ALERT_EMAIL:'operator@example.com'};
  globalThis.fetch = async (url, options) => {
    if (url === 'https://api.resend.com/emails') {
      mails.push(options.headers['Idempotency-Key']);
      if (mailFail) return new Response('',{status:503});
      return Response.json({id:'sent'});
    }
    assert.equal(url,'https://primo-hosting-control.fly.dev/ops/monitor');
    assert.equal(options.headers.Authorization,'Bearer read-only');
    assert.equal(options.redirect,'manual');
    return Response.json({schema:1,checked_at:Math.floor(Date.now()/1000),ok:!fail,issues:fail?['billing_notification_pending']:[]});
  };
  try {
    const check = async () => new MonitorState(ctx,env).fetch(new Request('https://monitor.internal/check',{method:'POST'}));
    await check(); assert.equal(mails.length,0);
    mailFail=true; await check(); assert.equal(mails.length,1); assert.equal(values.get('state').mailError,true);
    mailFail=false; await check(); assert.equal(mails[0],mails[1]);
    await check(); assert.equal(mails.length,2);
    const saved=values.get('state'); saved.lastAlert-=86401; values.set('state',saved);
    await check(); assert.equal(mails.length,3);
    fail=false; await check(); assert.equal(mails.length,3);
    await check(); assert.equal(mails.length,4); assert.match(mails[3],/^primo-monitor-recovery/);
    await check(); assert.equal(mails.length,4); assert.equal(values.get('state').incident,0);
  } finally {globalThis.fetch=realFetch;}
});
test('monitor routes deny anonymous access and scheduled checks use the singleton', async()=>{
  assert.equal((await worker.fetch(new Request('https://monitor/status'),{ADMIN_TOKEN:'private'})).status,404);
  let invoked=0,pending;
  await worker.scheduled({}, {MONITOR_STATE:{idFromName:n=>{assert.equal(n,'hosting');return 'one';},get:id=>({fetch:async(url,opts)=>{invoked++;assert.equal(url,'https://monitor.internal/scheduled');assert.equal(opts.method,'POST');return new Response('');}})}}, {waitUntil:p=>pending=p});
  await pending;assert.equal(invoked,1);
});
test('failed requests redact credentials and redirected health checks fail without forwarding keys',async()=>{
  const realFetch=globalThis.fetch;
  const values=new Map();
  const ctx={storage:{get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v))},blockConcurrencyWhile:fn=>fn()};
  const env={MONITOR_TOKEN:'private-health-credential',RESEND_API_KEY:'private-mail-credential',ADMIN_TOKEN:'private-admin-credential',SOURCE_VERSION:'test-version'};
  const monitor=new MonitorState(ctx,env);
  try {
    globalThis.fetch=async(url,options)=>{
      assert.ok(options.signal instanceof AbortSignal);
      throw new Error('Connection failed '+env.MONITOR_TOKEN+' Bearer '+env.RESEND_API_KEY+' '+env.ADMIN_TOKEN);
    };
    await monitor.fetch(new Request('https://monitor.internal/check',{method:'POST'}));
    let state=values.get('state');
    for(const key of ['MONITOR_TOKEN','RESEND_API_KEY','ADMIN_TOKEN'])assert.ok(!state.probeError.includes(env[key]));
    assert.equal(state.lastScheduledAt,undefined);
    assert.equal(state.version,'test-version');
    globalThis.fetch=async(url,options)=>{
      if(url==='https://api.resend.com/emails')return Response.json({id:'sent'});
      assert.equal(options.redirect,'manual');
      return new Response('',{status:302,headers:{Location:'https://unexpected.example/health'}});
    };
    await monitor.fetch(new Request('https://monitor.internal/scheduled',{method:'POST'}));
    state=values.get('state');
    assert.equal(state.probeStatus,302);
    assert.deepEqual(state.issues,['control_service_unavailable']);
    assert.ok(state.lastScheduledAt>0);
  } finally {globalThis.fetch=realFetch;}
});
