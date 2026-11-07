-- Creates all neccessary scripts for the gui on initial load, everything except build tools
-- Created by Ben T. 10/29/10
-- Please note that these are loaded in a specific order to diminish errors/perceived load time by user

local scriptContext = game:GetService("ScriptContext")
local touchEnabled = game:GetService("UserInputService").TouchEnabled

local RobloxGui = game:GetService("CoreGui"):WaitForChild("RobloxGui")

local soundFolder = Instance.new("Folder")
soundFolder.Name = "Sounds"
soundFolder.Parent = RobloxGui

-- TopBar
-- 2x2 always supplies the 2016 topbar core script. The reconstructed
-- settings service may not contain the original UseInGameTopBar feature flag,
-- so a missing flag must not disable the entire navigation and health HUD.
local useTopBar = true
local topbarStarted, topbarError = pcall(function()
	scriptContext:AddCoreScriptLocal("CoreScripts/Topbar", RobloxGui)
end)
if not topbarStarted then
	warn("[2x2 core] Topbar startup failed: " .. tostring(topbarError))
	useTopBar = false
end

-- SettingsScript
local luaControlsSuccess, luaControlsFlagValue = pcall(function() return settings():GetFFlag("UseLuaCameraAndControl") end)

-- MainBotChatScript (the Lua part of Dialogs)
scriptContext:AddCoreScriptLocal("CoreScripts/MainBotChatScript2", RobloxGui)

-- Developer Console Script
scriptContext:AddCoreScriptLocal("CoreScripts/DeveloperConsole", RobloxGui)

-- In-game notifications script
scriptContext:AddCoreScriptLocal("CoreScripts/NotificationScript2", RobloxGui)

-- Chat must be initialized whether or not the top-bar feature flag exists.
-- Chat.lua supports both top-bar and legacy layouts.
if not useTopBar then
	spawn(function()
		local ok, err = pcall(function()
			require(RobloxGui.Modules:WaitForChild("Chat"))
		end)
		if not ok then warn("[2x2 core] Chat module failed: " .. tostring(err)) end
	end)
end
if useTopBar then
	spawn(function() require(RobloxGui.Modules.PlayerlistModule) end)
end

local luaBubbleChatSuccess, luaBubbleChatFlagValue = pcall(function() return settings():GetFFlag("LuaBasedBubbleChat") end)
if luaBubbleChatSuccess and luaBubbleChatFlagValue then
	scriptContext:AddCoreScriptLocal("CoreScripts/BubbleChat", RobloxGui)
end

-- Purchase Prompt Script
scriptContext:AddCoreScriptLocal("CoreScripts/PurchasePromptScript2", RobloxGui)

-- Health Script
if not useTopBar then
	scriptContext:AddCoreScriptLocal("CoreScripts/HealthScript", RobloxGui)
end

do -- Backpack!
	spawn(function() require(RobloxGui.Modules.BackpackScript) end)
end

if useTopBar then
	scriptContext:AddCoreScriptLocal("CoreScripts/VehicleHud", RobloxGui)
end

scriptContext:AddCoreScriptLocal("CoreScripts/GamepadMenu", RobloxGui)

if touchEnabled then -- touch devices don't use same control frame
	-- only used for touch device button generation
	scriptContext:AddCoreScriptLocal("CoreScripts/ContextActionTouch", RobloxGui)

	RobloxGui:WaitForChild("ControlFrame")
	RobloxGui.ControlFrame:WaitForChild("BottomLeftControl")
	RobloxGui.ControlFrame.BottomLeftControl.Visible = false
end
