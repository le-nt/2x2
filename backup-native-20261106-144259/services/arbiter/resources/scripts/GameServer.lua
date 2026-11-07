--rbxsig%=0
-- Begin gameserver.lua
function start(_a, _b, _c) end
local PlaceId, GamePort, BaseUrl = ...
print(
	"Beginning ROBLOX gameserver at "
		.. tick()
		.. " with PlaceId: "
		.. tostring(PlaceId)
		.. ", GamePort: "
		.. tostring(GamePort)
		.. ", BaseUrl: "
		.. tostring(BaseUrl)
)

local function log(msg)
	print("[" .. tostring(game.JobId) .. "] " .. tostring(msg))
end

local function log_warn(msg)
	warn("[" .. tostring(game.JobId) .. "] " .. tostring(msg))
end

game:GetService("HttpService").HttpEnabled = true
function heartbeat(userIds)
	local payload = {
		jobId = game.JobId,
	}

	if userIds ~= nil then
		payload.userIds = userIds
	end

	local payloadHttp = game:GetService("HttpService"):JSONEncode(payload)
	print(payloadHttp)
	game:HttpPost(BaseUrl .. "/internal/gameserver/heartbeat", payloadHttp, false, "application/json")
end

function shutdown()
	local payload = {
		jobId = game.JobId,
	}

	local payloadHttp = game:GetService("HttpService"):JSONEncode(payload)
	print(payloadHttp)
	game:HttpPost(BaseUrl .. "/internal/gameserver/shutdown", payloadHttp, false, "application/json")
end

assert(PlaceId, "Missing PlaceId")
assert(GamePort, "Missing GamePort")
assert(BaseUrl, "Missing BaseUrl")

settings().Network.UseInstancePacketCache = true
settings().Network.UsePhysicsPacketCache = true
settings()["Task Scheduler"].PriorityMethod = Enum.PriorityMethod.AccumulatedError

settings().Network.PhysicsSend = Enum.PhysicsSendMethod.TopNErrors
settings().Network.ExperimentalPhysicsEnabled = true
settings().Network.WaitingForCharacterLogRate = 100
settings().Diagnostics:LegacyScriptMode()

local scriptContext = game:GetService("ScriptContext")
pcall(function()
	scriptContext:AddStarterScript(37801172)
end)
-- scriptContext:AddStarterScript(37801172)
scriptContext.ScriptsDisabled = true

game:SetPlaceID(PlaceId, false)
game:GetService("ChangeHistoryService"):SetEnabled(false)

local ns = game:GetService("NetworkServer")

if BaseUrl ~= nil then
	local Players = game:GetService("Players")
	local ContentProvider = game:GetService("ContentProvider")
	local ScriptInfoProvider = game:GetService("ScriptInformationProvider")
	local BadgeService = game:GetService("BadgeService")
	local InsertService = game:GetService("InsertService")

	Players:SetAbuseReportUrl(BaseUrl .. "/AbuseReport/InGameChatHandler.ashx")
	ScriptInfoProvider:SetAssetUrl(BaseUrl .. "/Asset/")
	ContentProvider:SetBaseUrl(BaseUrl .. "/")
	Players:SetChatFilterUrl(BaseUrl .. "/Game/ChatFilter.ashx")

	BadgeService:SetPlaceId(PlaceId)
	BadgeService:SetIsBadgeLegalUrl("")

	local success, err = pcall(function()
		loadfile(BaseUrl .. "/Game/LoadPlaceInfo.ashx?PlaceId=" .. PlaceId)()
	end)

	if not success then
		log_warn("Failed to load place info: " .. tostring(err))
	end
end

game:GetService("NetworkServer"):SetIsPlayerAuthenticationRequired(false) -- set to true in prod pls
settings().Diagnostics.LuaRamLimit = 0

game:GetService("Players").PlayerAdded:connect(function(player)
	local userIds = {}
	for _, p in pairs(game:GetService("Players"):GetPlayers()) do
		table.insert(userIds, p.UserId)
	end
	heartbeat(userIds)
	log("Player " .. player.UserId .. " added, sent with userIds: " .. table.concat(userIds, ", "))
end)

game:GetService("Players").PlayerRemoving:connect(function(player)
	local userIds = {}
	for _, p in pairs(game:GetService("Players"):GetPlayers()) do
		table.insert(userIds, p.UserId)
	end
	heartbeat(userIds)
	log("Player " .. player.UserId .. " removed, sent with userIds: " .. table.concat(userIds, ", "))
end)

wait()
local ok, err = pcall(function()
    game:Load(BaseUrl .. "/asset/?id=" .. PlaceId)
end)
if not ok then
    log_warn("Loading game failed: " .. tostring(err))
    shutdown()
    return
end
--game:Load("rbxasset://test.rbxl") -- UNIT TEST ONLY DUMBASS

ns:Start(GamePort)
log("NetworkServer started on port " .. GamePort)
heartbeat(nil)

scriptContext:SetTimeout(10)
scriptContext.ScriptsDisabled = false

game:GetService("RunService"):Run()

game.Close:connect(function()
	log("Game closing")
	shutdown()
end)

spawn(function()
	while true do
		log("Heartbeat " .. tick())
		log("Next heartbeat at " .. tick() + 30)
		local userIds = {}
		for _, player in pairs(game:GetService("Players"):GetPlayers()) do
			table.insert(userIds, player.UserId)
		end
		if #userIds > 0 then
			heartbeat(userIds)
		else
			log_warn("Heartbeat skipped! No players")
		end
		wait(30)
	end
end)

return
