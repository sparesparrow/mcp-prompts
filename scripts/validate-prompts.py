#!/usr/bin/env python3
"""Validate prompt JSON files: schema, id==filename, semver, variables vs {{placeholders}}, literal \\n, duplicates.
Usage: validate-prompts.py <prompts-dir>   (exit 1 on any error)"""
import json,re,sys,glob,os,collections
root=sys.argv[1] if len(sys.argv)>1 else 'data/prompts'
PH=re.compile(r'(?<!\$)\{\{\s*([A-Za-z_]\w*)\s*\}\}'); BLK=re.compile(r'\{\{#(?:if|each|unless)\s+([A-Za-z_]\w*)')
SEMVER=re.compile(r'^\d+\.\d+\.\d+(-[\w.]+)?$'); STATUS={'draft','stable','deprecated'}
errs=[]; ids={}; bodies=collections.defaultdict(list)
def e(f,m): errs.append(f'{os.path.relpath(f,root)}: {m}')
for f in sorted(glob.glob(root+'/**/*',recursive=True)):
    if os.path.isdir(f): continue
    if not f.endswith('.json'): e(f,'unexpected non-.json file'); continue
    try: j=json.load(open(f))
    except Exception as x: e(f,f'invalid JSON ({x})'); continue
    if not isinstance(j,dict): e(f,'top level must be an object'); continue
    for k,t in [('id',str),('name',str),('description',str),('content',str),('isTemplate',bool),('variables',list),('tags',list),('version',str)]:
        if not isinstance(j.get(k),t): e(f,f'{k} missing or not {t.__name__}')
    if j.get('id')!=os.path.basename(f)[:-5]: e(f,f'id {j.get("id")!r} != filename')
    if j.get('id') in ids: e(f,f'duplicate id (also {ids[j["id"]]})')
    ids[j.get('id')]=f
    if isinstance(j.get('version'),str) and not SEMVER.match(j['version']): e(f,f'version {j["version"]!r} is not semver')
    if j.get('status') not in STATUS: e(f,'status must be draft|stable|deprecated')
    c=j.get('content') or ''
    if not c.strip(): e(f,'empty content')
    if '\\n' in c and '\n' not in c: e(f,'content has literal \\n and no real newlines (double-escaped)')
    ph=(set(PH.findall(c))|set(BLK.findall(c)))-{'this'}; vs=set(j.get('variables') or [])
    if ph!=vs: e(f,f'variables mismatch: undeclared={sorted(ph-vs)} unused={sorted(vs-ph)}')
    if j.get('isTemplate')!=bool(ph): e(f,'isTemplate disagrees with placeholders')
    bodies[c.strip()].append(f)
for c,fs in bodies.items():
    if len(fs)>1: errs.append('duplicate content: '+', '.join(os.path.relpath(x,root) for x in fs))
print(f'{len(ids)} prompts checked, {len(errs)} problems'); [print(' ',x) for x in errs]; sys.exit(1 if errs else 0)
