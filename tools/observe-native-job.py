#!/usr/bin/env python3
"""Read native player/physics/tool state from an existing loopback RCC test job.

The default observation script does not mutate game objects. Optional event
counters observe native signals; --client-audio-user or --client-runtime-user
installs one bounded, read-only diagnostic LocalScript in that test user's PlayerGui. No gameplay is
injected and no credentials are read. Keep this tool off public endpoints.
"""
import argparse
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape

CLIENT_AUDIO='''local root=game:GetService("ReplicatedFirst")
if script.Parent~=root then
 if not root:FindFirstChild("__2x2ClientAudioObserverV3Local") then
  local copy=script:Clone();copy.Name="__2x2ClientAudioObserverV3Local";copy.Parent=root
 end
 return
end
local count=0
local seen=setmetatable({},{__mode="k"})
local function emit(data) data.version=3;print("[2x2 client observation] "..game:GetService("HttpService"):JSONEncode(data)) end
local player=game:GetService("Players").LocalPlayer
local humanoid=player.Character and player.Character:FindFirstChild("Humanoid")
emit({phase="started",placeId=game.PlaceId,health=humanoid and humanoid.Health or nil})
local function inspect(item)
 if count>=16 or not item:IsA("Sound") or seen[item] or (item.Name~="Swoosh" and item.Name~="Fire") then return end
 seen[item]=true;count=count+1
 local sampleId=count
 for _,interval in pairs({0.25,0.75}) do
  delay(interval,function()
   if item:IsDescendantOf(workspace) then
    emit({phase="audio",sampleId=sampleId,path=item:GetFullName(),soundId=tostring(item.SoundId),playing=item.IsPlaying,position=item.TimePosition,length=item.TimeLength,sampleDelay=interval})
   end
  end)
 end
end
workspace.DescendantAdded:connect(inspect)
local visited=0
local function visit(item,depth)
 if visited>=20000 or depth>64 or count>=16 then return end
 visited=visited+1
 if item:IsA("Sound") and item.IsPlaying then inspect(item) end
 for _,child in pairs(item:GetChildren()) do visit(child,depth+1) end
end
visit(workspace,0)
'''

CLIENT_RUNTIME='''local root=game:GetService("ReplicatedFirst")
if script.Parent~=root then
 if not root:FindFirstChild("__2x2ClientRuntimeObserverV2Local") then
  local copy=script:Clone();copy.Name="__2x2ClientRuntimeObserverV2Local";copy.Parent=root
 end
 return
end
local player=game:GetService("Players").LocalPlayer
local input=game:GetService("UserInputService")
local run=game:GetService("RunService")
local steps,renders,events=0,0,0
local function emit(data) print("[2x2 runtime observation] "..game:GetService("HttpService"):JSONEncode(data)) end
local function vector(v) return v and {x=v.X,y=v.Y,z=v.Z} or nil end
local function scene()
 local result={gui={}}
 local camera=workspace.CurrentCamera
 if camera then result.camera={type=tostring(camera.CameraType),subject=camera.CameraSubject and camera.CameraSubject:GetFullName() or "",position=vector(camera.CoordinateFrame.p),focus=vector(camera.Focus.p)} end
 local gui=player:FindFirstChild("PlayerGui")
 if gui then for index,child in ipairs(gui:GetChildren()) do
  if index>24 then break end
  local item={name=child.Name,class=child.ClassName,children=#child:GetChildren()}
  local ok,enabled=pcall(function() return child.Enabled end);if ok then item.enabled=enabled end
  table.insert(result.gui,item)
 end end
 return result
end
local connections={
 run.Stepped:connect(function() steps=steps+1 end),
 run.RenderStepped:connect(function() renders=renders+1 end)
}
local function observed(kind,event,processed)
 if events>=64 then return end
 events=events+1
 emit({phase=kind,key=tostring(event.KeyCode),inputType=tostring(event.UserInputType),processed=processed,time=tick()})
end
table.insert(connections,input.InputBegan:connect(function(event,processed) observed("input_begin",event,processed) end))
table.insert(connections,input.InputEnded:connect(function(event,processed) observed("input_end",event,processed) end))
for sample=1,120 do
 local character=player.Character
 local humanoid=character and character:FindFirstChild("Humanoid")
 local torso=character and (character:FindFirstChild("HumanoidRootPart") or character:FindFirstChild("Torso"))
 local network=game:FindFirstChild("NetworkClient")
 local extra=nil;if sample==1 or sample%10==0 then local ok,result=pcall(scene);extra=ok and result or {error=tostring(result)} end
 emit({version=2,scene=extra,phase="heartbeat",sample=sample,time=tick(),steps=steps,renders=renders,keyboard=input.KeyboardEnabled,mouse=input.MouseEnabled,wDown=input:IsKeyDown(Enum.KeyCode.W),health=humanoid and humanoid.Health or nil,moveDirection=humanoid and vector(humanoid.MoveDirection) or nil,position=torso and vector(torso.Position) or nil,networkChildren=network and #network:GetChildren() or 0})
 wait(1)
end
for _,connection in pairs(connections) do connection:disconnect() end
'''

PROJECTILES='''local projectileNames={Rocket=true,Bullet=true,Pellet=true,Timebomb=true,CannonBall=true,Paintball=true,Teapot=true}
local function isProjectile(item)
 return item:IsA("BasePart") and (projectileNames[item.Name] or item:FindFirstChild("RocketScript") or item:FindFirstChild("ProjectileScript") or item:FindFirstChild("BombScript"))
end
'''

EVENTS='''if not _G.__2x2ValidationObserverV3 then
 local events={}
 for _,event in ipairs(_G.__2x2ValidationEvents or {}) do if #events<128 then table.insert(events,event) end end
 local activations={}
 _G.__2x2ValidationObserverV3={events=events,toolActivations=activations}
 local seen=setmetatable({},{__mode="k"})
 local function record(kind,item)
  if #events>=128 then table.remove(events,1) end
  local creator=item:FindFirstChild("creator") or item:FindFirstChild("Creator")
  local owner=creator and creator:IsA("ObjectValue") and creator.Value
  table.insert(events,{kind=kind,name=item.Name,path=item:GetFullName(),time=tick(),creator=owner and owner:GetFullName() or nil})
 end
 local function tool(item)
  if item:IsA("Tool") and not seen[item] then
   seen[item]=true;item.Activated:connect(function()
    record("tool_activated",item)
    if #activations>=32 then table.remove(activations,1) end
    local player=game:GetService("Players"):GetPlayerFromCharacter(item.Parent)
    table.insert(activations,{name=item.Name,path=item:GetFullName(),userId=player and player.UserId or nil,time=tick()})
   end)
  end
 end
 local function character(char)
  for _,item in pairs(char:GetChildren()) do tool(item) end
  char.ChildAdded:connect(tool)
 end
 local function watchPlayer(player)
  if seen[player] then return end
  seen[player]=true
  if player.Character then character(player.Character) end
  player.CharacterAdded:connect(character)
 end
 local players=game:GetService("Players")
 players.PlayerAdded:connect(watchPlayer)
 for _,player in pairs(players:GetPlayers()) do watchPlayer(player) end
 workspace.ChildAdded:connect(function(item)
  if isProjectile(item) then record("projectile_created",item)
  elseif item:IsA("Explosion") then record("explosion_created",item) end
 end)
end
'''

OBSERVE='''local report={placeId=game.PlaceId,players={},projectiles={},humanoids={},objectValues={},instanceCount=0,clientAudioObserver=clientProbeStatus,clientRuntimeObserver=clientRuntimeStatus,observedEvents=_G.__2x2ValidationObserverV3 and _G.__2x2ValidationObserverV3.events or _G.__2x2ValidationObserverV2 and _G.__2x2ValidationObserverV2.events or _G.__2x2ValidationEvents,toolActivations=_G.__2x2ValidationObserverV3 and _G.__2x2ValidationObserverV3.toolActivations}
local function position(part)
 if not part then return nil end
 local p=part.Position;return {x=p.X,y=p.Y,z=p.Z}
end
local function modelPart(model)
 local part=model:FindFirstChild("Torso") or model:FindFirstChild("HumanoidRootPart") or model:FindFirstChild("Head") or model.PrimaryPart
 if part then return part end
 for _,child in pairs(model:GetChildren()) do if child:IsA("BasePart") then return child end end
end
for _,player in pairs(game:GetService("Players"):GetPlayers()) do
 local char=player.Character
 local humanoid=char and char:FindFirstChild("Humanoid")
 local torso=char and modelPart(char)
 local tools={}
 local backpack={}
 local pack=player:FindFirstChild("Backpack")
 if pack then for _,item in pairs(pack:GetChildren()) do table.insert(backpack,{name=item.Name,class=item.ClassName}) end end
 if char then for _,item in pairs(char:GetChildren()) do if item:IsA("Tool") or item:IsA("HopperBin") then table.insert(tools,{name=item.Name,class=item.ClassName}) end end end
 table.insert(report.players,{name=player.Name,userId=player.UserId,teamColor=tostring(player.TeamColor),position=position(torso),health=humanoid and humanoid.Health or nil,equipped=tools,backpack=backpack})
end
for _,item in pairs(workspace:GetChildren()) do
 if isProjectile(item) then table.insert(report.projectiles,{name=item.Name,position=position(item)}) end
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
  local torso=modelPart(item)
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
    client_probe=p.add_mutually_exclusive_group()
    client_probe.add_argument('--client-audio-user',type=int,help='Install the fixed audio diagnostic LocalScript for this isolated test user ID')
    client_probe.add_argument('--client-runtime-user',type=int,help='Install the bounded input/frame/connection diagnostic LocalScript for this isolated test user ID')
    a=p.parse_args()
    if not 1024<a.port<65536 or not re.fullmatch(r'[A-Za-z0-9-]{1,100}',a.job):raise ValueError('Invalid local job/port')
    code=PROJECTILES+(EVENTS if a.start_event_observation else '')+OBSERVE
    client_user=a.client_audio_user if a.client_audio_user is not None else a.client_runtime_user
    if client_user is not None:
        if not 0<client_user<2147483647:raise ValueError('Invalid test user ID')
        observer_name='__2x2ClientRuntimeObserverV2' if a.client_runtime_user is not None else '__2x2ClientAudioObserverV3'
        code='''local clientProbeStatus="user_not_found"
for _,player in pairs(game:GetService("Players"):GetPlayers()) do
 if player.UserId==USER_ID then
  local gui=player:FindFirstChild("PlayerGui")
  if not gui then clientProbeStatus="player_gui_missing"
  elseif gui:FindFirstChild("OBSERVER_NAME") then clientProbeStatus="already_present"
  else
   local observer=Instance.new("LocalScript");observer.Name="OBSERVER_NAME"
   observer.Source=[====[CLIENT_SOURCE]====];observer.Parent=gui;clientProbeStatus="installed"
  end
 end
end
'''.replace('USER_ID',str(client_user)).replace('OBSERVER_NAME',observer_name).replace('CLIENT_SOURCE',CLIENT_RUNTIME if a.client_runtime_user is not None else CLIENT_AUDIO)+('local clientRuntimeStatus=clientProbeStatus;clientProbeStatus=nil\n' if a.client_runtime_user is not None else '')+code
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
