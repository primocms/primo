import argparse,hashlib,json,secrets,time,urllib.request,urllib.error,uuid
from pathlib import Path
parser=argparse.ArgumentParser(description='Deploy the independent monitor with approved private credentials; never prints secret values.')
parser.add_argument('--private-dir',required=True,type=Path)
args=parser.parse_args()
root=args.private_dir.resolve()
repo=Path(__file__).resolve().parents[2]
if root.stat().st_mode & 0o077:raise RuntimeError('Private directory must have mode 700')
account='ff5f3f8917642d3f91fe4898a9d89ee2'
name='primo-hosting-monitor'
# This file is created only after the exact browser credential approval.
key=json.loads((root/'cloudflare-monitor-deploy-key.json').read_text())['token']
deployment=json.loads((root/'deployment-sandbox.json').read_text())
config_path=root/'external-monitor.private.json'
if config_path.exists():config=json.loads(config_path.read_text())
else:
 config={'account_id':account,'worker':name,'admin_token':secrets.token_urlsafe(48)}
 config_path.write_text(json.dumps(config,indent=2)+'\n');config_path.chmod(0o600)
config.update(monitor_token=deployment['secrets']['HOSTING_MONITOR_TOKEN'],resend_api_key=deployment['secrets']['RESEND_API_KEY'],from_email=deployment['secrets']['HOSTING_FROM_EMAIL'],alert_email=deployment['secrets']['HOSTING_ALERT_EMAIL'])
config_path.write_text(json.dumps(config,indent=2)+'\n');config_path.chmod(0o600)
api='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers'
def req(method,path,body=None,content_type='application/json'):
 data=None if body is None else (body if isinstance(body,bytes) else json.dumps(body).encode())
 request=urllib.request.Request(api+path,method=method,data=data,headers={'Authorization':'Bearer '+key,'Content-Type':content_type})
 try:
  with urllib.request.urlopen(request,timeout=40) as response:
   result=json.load(response)
   if not result.get('success'):raise RuntimeError('Cloudflare operation failed; codes='+str([e.get('code') for e in result.get('errors',[])]))
   return result['result']
 except urllib.error.HTTPError as error:
  try:codes=[e.get('code') for e in json.loads(error.read()).get('errors',[])]
  except:codes=[]
  raise RuntimeError('Cloudflare operation HTTP '+str(error.code)+' codes='+str(codes)) from None
scripts=req('GET','/scripts')
exists=next((s for s in scripts if s['id']==name),None)
if exists and not config.get('created'):raise RuntimeError('A pre-existing monitor name requires review before replacement')
source=(repo/'deploy/monitor/worker.mjs').read_bytes()
source_hash=hashlib.sha256(source).hexdigest()
metadata={'main_module':'worker.mjs','compatibility_date':'2026-10-04','bindings':[
 {'type':'durable_object_namespace','name':'MONITOR_STATE','class_name':'MonitorState'},
 {'type':'secret_text','name':'ADMIN_TOKEN','text':config['admin_token']},
 {'type':'secret_text','name':'MONITOR_TOKEN','text':config['monitor_token']},
 {'type':'secret_text','name':'RESEND_API_KEY','text':config['resend_api_key']},
 {'type':'plain_text','name':'FROM_EMAIL','text':config['from_email']},
 {'type':'plain_text','name':'ALERT_EMAIL','text':config['alert_email']}],
 'tags':['primo-hosting-independent-monitor']}
metadata['bindings'].append({'type':'plain_text','name':'SOURCE_VERSION','text':source_hash})
if not exists:metadata['migrations']={'new_tag':'v1','new_sqlite_classes':['MonitorState']}
boundary='primo'+uuid.uuid4().hex
parts=[]
for field,filename,ctype,data in [('metadata','metadata.json','application/json',json.dumps(metadata).encode()),('worker.mjs','worker.mjs','application/javascript+module',source)]:
 parts.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+field+'"; filename="'+filename+'"\r\nContent-Type: '+ctype+'\r\n\r\n').encode()+data+b'\r\n')
payload=b''.join(parts)+('--'+boundary+'--\r\n').encode()
result=req('PUT','/scripts/'+name,payload,'multipart/form-data; boundary='+boundary)
config.update(created=True,source_sha256=source_hash)
config_path.write_text(json.dumps(config,indent=2)+'\n');config_path.chmod(0o600)
req('POST','/scripts/'+name+'/subdomain',{'enabled':True,'previews_enabled':False})
subdomain=req('GET','/subdomain')['subdomain']
url='https://'+name+'.'+subdomain+'.workers.dev'
config['url']=url;config_path.write_text(json.dumps(config,indent=2)+'\n');config_path.chmod(0o600)
req('PUT','/scripts/'+name+'/schedules',[{'cron':'*/5 * * * *'}])
assert [s['cron'] for s in req('GET','/scripts/'+name+'/schedules')['schedules']]==['*/5 * * * *']
def check():
 request=urllib.request.Request(url+'/check',method='POST',headers={'Authorization':'Bearer '+config['admin_token'],'User-Agent':'PrimoHostingOperator/1.0'})
 with urllib.request.urlopen(request,timeout=35) as response:return json.load(response)
for attempt in range(12):
 try:
  status=check()
  if status.get('version')==source_hash and status['issues']==[] and status['checkedAt']>time.time()-120 and not status.get('mailError'):break
 except (urllib.error.URLError,TimeoutError,OSError):time.sleep(2)
 else:time.sleep(2)
else:raise RuntimeError('Cloudflare monitor did not become available')
assert status['issues']==[] and status['checkedAt']>time.time()-120 and not status.get('mailError')
status=check();assert status['successes']>=2
proof_path=root/'external-monitor-proof.json'
proof=json.loads(proof_path.read_text()) if proof_path.exists() else {}
proof.update(status='deployed',worker=name,url=url,schedule='every five minutes',checks='private read-only endpoint healthy; persisted two successful checks',source_sha256=source_hash,alert_policy='two failures open incident; two successes recover; daily reminders; sending failures retry',runtime_access='aggregate read-only health and sending-only Resend; no Fly, DNS or R2 administration')
if proof.get('incident_email',{}).get('status')=='delivered' and proof.get('recovery_email',{}).get('status')=='delivered' and status.get('lastScheduledAt',0)>0:proof['status']='operational'
(root/'external-monitor-proof.json').write_text(json.dumps(proof,indent=2)+'\n');(root/'external-monitor-proof.json').chmod(0o600)
print('PASS: Cloudflare monitor deployed; five-minute schedule and two private healthy checks verified.')
