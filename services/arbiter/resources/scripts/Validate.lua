local PlaceId, BaseUrl = ... 

local ContentProvider = game:GetService("ContentProvider")
game:GetService('StarterGui'):SetCoreGuiEnabled(Enum.CoreGuiType.All, false);

pcall(function() game:GetService("ContentProvider"):SetBaseUrl(BaseUrl) end)
game:GetService("ScriptContext").ScriptsDisabled = true

local success, err = pcall(function()
    game:Load(baseUrl .. "/asset/?id=" .. tostring(PlaceId) .. "&validate=true")
end)
if not success then
    return false
end
return true