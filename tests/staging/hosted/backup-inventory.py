"""Read an owned synthetic native backup without extracting its storage tree."""
import hashlib, json, sqlite3, sys, zipfile
from pathlib import Path
archive=Path(sys.argv[1]).resolve()
assert archive.parent.name=='private' and archive.name.startswith('rc7-owned-'), 'Only this run\'s private synthetic backup is accepted'
fields={
 'sites':['id','name','host','group'],
 'pages':['id','site','page_type','parent','name','slug','index','compiled_html'],
 'page_types':['id','site','name'],
 'page_sections':['id','page','symbol','index'],
 'site_symbols':['id','site','name','html','css','js','raw_source','compiled_js'],
 'site_symbol_fields':['id','symbol','key','type','parent','index'],
 'page_section_entries':['id','section','field','parent','locale','index','value'],
 'site_role_assignments':['id','site','user','role'],
 'users':['id','email','name','serverRole','invite'],
 'site_uploads':['id','site','file'],
}
database=archive.with_suffix('.db')
created=False
connection=None
try:
 with zipfile.ZipFile(archive) as source:
  name=next(n for n in source.namelist() if n=='data.db')
  with database.open('xb') as destination:
   created=True
   destination.write(source.read(name))
  database.chmod(0o600)
  connection=sqlite3.connect('file:'+str(database)+'?mode=ro&immutable=1',uri=True)
  result={'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'tables':{},'fileHashes':{}}
  for table,keys in fields.items():
   available={row[1] for row in connection.execute('PRAGMA table_info("'+table+'")')}
   assert set(keys)<=available, 'Expected RC.7 schema fields missing in '+table
   present=keys
   rows=[]
   for values in connection.execute('SELECT '+','.join('"'+key+'"' for key in present)+' FROM "'+table+'" ORDER BY id'):
    row=dict(zip(present,values))
    for key in ['value','compiled_html','compiled_js','file']:
     if isinstance(row.get(key),str):
      try:row[key]=json.loads(row[key])
      except (ValueError,TypeError):pass
    rows.append(row)
   result['tables'][table]=rows
  for member in source.infolist():
   if not member.is_dir() and member.filename.startswith('storage/'):
    result['fileHashes'][member.filename]=hashlib.sha256(source.read(member)).hexdigest()
  connection.close()
 print(json.dumps(result))
finally:
 if connection is not None:connection.close()
 if created and database.exists():database.unlink()
