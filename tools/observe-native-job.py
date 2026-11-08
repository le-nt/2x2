#!/usr/bin/env python3
"""Read native player/physics/tool state from an existing loopback RCC test job.

The fixed observation script does not mutate game objects, inject gameplay or
read production credentials. Optional event counters observe native signals in
the job's private diagnostic table. Keep this tool off public endpoints.
"""
import argparse
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape

EVENTS='''if not _G.__2x2ValidationEvents then
 local events={};_G.__2x2ValidationEvents=events
 local seen=setmetatable({},{__mode="k"})
 local function record(kind,item)
  if #events<128 then table.insert(events,{kind=kind,name=item.Name,path=item:GetFullName(),time=tick()}) end
 end
 local function tool(item)
  if item:IsA("Tool") and not seen[item] then
   seen[item]=true;item.Activated:connect(function() record("tool_activated",item) end)
  end
 end
 local function character(char)
  for _,item in pairs(char:GetChildren()) do tool(item) end
  char.ChildAdded:connect(tool)
 end
 for _,player in pairs(game:GetService("Players"):GetPlayers()) do
  if player.Character then character(player.Character) end
  player.CharacterAdded:connect(character)
 end
 local names={Rocket=true,Bullet=true,Pellet=true,Timebomb=true,CannonBall=true,Paintball=true}
 workspace.ChildAdded:connect(function(item) if names[item.Name] and item:IsA("BasePart") then record("projectile_created",item) end end)
end
'''

OBSERVE='''local report={placeId=game.PlaceId,players={},projectiles={},humanoids={},objectValues={},instanceCount=0,observedEvents=_G.__2x2ValidationEvents}
local function position(part)
 if not part then return nil end
 local p=part.Position;return {x=p.X,y=p.Y,z=p.Z}
end
for _,player in pairs(game:GetService("Players"):GetPlayers()) do
 local char=player.Character
 local humanoid=char and char:FindFirstChild("Humanoid")
 local torso=char and (char:FindFirstChild("Torso") or char:FindFirstChild("HumanoidRootPart"))
 local tools={}
 local backpack={}
 local pack=player:FindFirstChild("Backpack")
 if pack then for _,item in pairs(pack:GetChildren()) do table.insert(backpack,{name=item.Name,class=item.ClassName}) end end
 if char then for _,item in pairs(char:GetChildren()) do if item:IsA("Tool") or item:IsA("HopperBin") then table.insert(tools,{name=item.Name,class=item.ClassName}) end end end
 table.insert(report.players,{name=player.Name,userId=player.UserId,teamColor=tostring(player.TeamColor),position=position(torso),health=humanoid and humanoid.Health or nil,equipped=tools,backpack=backpack})
end
local projectiles={Rocket=true,Bullet=true,Pellet=true,Timebomb=true,CannonBall=true,Paintball=true}
for _,item in pairs(workspace:GetChildren()) do
 if projectiles[item.Name] and item:IsA("BasePart") then table.insert(report.projectiles,{name=item.Name,position=position(item)}) end
end
local function visit(item,depth)
 if report.instanceCount>=30000 or depth>64 then return end
 report.instanceCount=report.instanceCount+1
 if item:IsA("ObjectValue") and #report.objectValues<256 then
  local value=item.Value
  table.insert(report.objectValues,{path=item:GetFullName(),hasValue=value~=nil,valuePath=value and value:GetFullName() or nil})
 end
 if item:IsA("Model") and #report.humanoids<64 then
  local humanoid=item:FindFirstChild("Humanoid")
  local torso=item:FindFirstChild("Torso") or item:FindFirstChild("HumanoidRootPart")
  if humanoid then table.insert(report.humanoids,{path=item:GetFullName(),health=humanoid.Health,position=position(torso)}) end
 end
 for _,child in pairs(item:GetChildren()) do visit(child,depth+1) end
end
visit(workspace,0)
return game:GetService("HttpService"):JSONEncode(report)'''

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--port',type=int,required=True)
    p.add_argument('--job',required=True)
    p.add_argument('--output',type=Path)
    p.add_argument('--start-event-observation',action='store_true')
    a=p.parse_args()
    if not 1024<a.port<65536 or not re.fullmatch(r'[A-Za-z0-9-]{1,100}',a.job):raise ValueError('Invalid local job/port')
    code=(EVENTS if a.start_event_observation else '')+OBSERVE
    body='<Execute xmlns="http://roblox.com/"><jobID>'+escape(a.job)+'</jobID><script><name>ReadNativeValidationState</name><script>'+escape(code)+'</script><arguments/></script></Execute>'
    envelope=('<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>'+body+'</soap:Body></soap:Envelope>').encode()
    request=urllib.request.Request('http://127.0.0.1:'+str(a.port)+'/',data=envelope,headers={'Content-Type':'text/xml; charset=utf-8','SOAPAction':'"http://roblox.com/Execute"'})
    with urllib.request.urlopen(request,timeout=10) as response:reply=response.read(2*1024*1024)
    parsed=ET.fromstring(reply)
    report=next(json.loads(e.text) for e in parsed.iter() if e.tag.rsplit('}',1)[-1]=='value' and e.text and e.text.startswith('{'))
    if a.output:
        a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))

if __name__=='__main__':main()
