#!/usr/bin/env python3
"""Read real native social API results in a marked, disposable local test job.

Installs a bounded diagnostic Script and result value, not gameplay or grants.
No original scripts, memberships, purchases or credentials are changed.
"""
import argparse,importlib.util,json,re,sqlite3,time,uuid
from pathlib import Path

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--stage',type=Path,required=True);p.add_argument('--port',type=int,required=True)
    p.add_argument('--job',required=True);p.add_argument('--user',type=int,required=True);p.add_argument('--output',type=Path,required=True)
    a=p.parse_args();root=Path(__file__).resolve().parents[1];stage=a.stage.resolve(strict=True)
    if not stage.is_relative_to(root/'work') or not 1024<a.port<65536 or not re.fullmatch('[A-Za-z0-9-]{1,100}',a.job) or not 0<a.user<2147483647:raise ValueError('Invalid isolated test target')
    if json.loads((stage/'validation-marker.json').read_text())['type']!='isolated-native-validation':raise ValueError('Not an isolated native fixture')
    db=sqlite3.connect('file:'+str(stage/'server/data/2x2.db')+'?mode=ro',uri=True)
    job=db.execute('SELECT place_id,players FROM native_jobs WHERE job_id=? AND closed=0',(a.job,)).fetchone()
    if not job or not db.execute('SELECT 1 FROM users WHERE id=?',(a.user,)).fetchone():raise ValueError('Unknown test job or local user')
    # This fixed probe expects deliberately unassigned IDs; never changes records.
    gamepass=2147000000
    assert not db.execute('SELECT 1 FROM native_game_passes WHERE user_id=? AND pass_id=?',(a.user,gamepass)).fetchone()
    db.close()
    spec=importlib.util.spec_from_file_location('native_probe',root/'tools/probe-native-datastore.py')
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    name='__2x2SocialProbe_'+uuid.uuid4().hex
    source='''local result=workspace:FindFirstChild("RESULT_NAME")
local ok,data=pcall(function()
 local p=game:GetService("Players"):GetPlayerByUserId(USER_ID);assert(p,"Missing test player")
 local rank=p:GetRankInGroup(2147000000);assert(rank==0,"Unexpected rank")
 local role=p:GetRoleInGroup(2147000000);assert(role=="Guest","Unexpected role")
 local member=p:IsInGroup(2147000000);assert(member==false,"Unexpected membership")
 local pass=game:GetService("GamePassService"):PlayerHasPass(p,2147000000);assert(pass==false,"Unexpected pass grant")
 return {rank=rank,role=role,member=member,pass=pass}
end)
result.Value=game:GetService("HttpService"):JSONEncode({ok=ok,result=ok and data or nil,error=not ok and tostring(data) or nil})
script:Destroy()'''.replace('RESULT_NAME',name).replace('USER_ID',str(a.user))
    code='local r=Instance.new("StringValue",workspace);r.Name="'+name+'";r.Value="running";local s=Instance.new("Script");s.Name="NativeSocialProbe";s.Source=[====['+source+']====];s.Parent=workspace;return "installed"'
    assert 'installed' in mod.execute(a.port,a.job,code)
    deadline=time.monotonic()+45;report=None
    while time.monotonic()<deadline:
        values=mod.execute(a.port,a.job,'local r=workspace:FindFirstChild("'+name+'");return r and r.Value or "missing"')
        text=next((v for v in values if v.startswith('{')),None)
        if text:report=json.loads(text);break
        time.sleep(.2)
    if report is None:raise TimeoutError('Native social diagnostic exceeded 45 seconds')
    report.update({'jobId':a.job,'placeId':job[0],'userId':a.user,'mutatedMemberships':False,'mutatedPurchases':False})
    a.output.parent.mkdir(parents=True,exist_ok=True)
    with a.output.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps(report));assert report['ok'],report

if __name__=='__main__':main()
