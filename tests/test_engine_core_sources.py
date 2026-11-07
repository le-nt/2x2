"""Source-level regression checks for the native 2016 Topbar, Chat and Health.

These tests do not substitute for rebuilding and playing the WebAssembly client.
"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "services/engine/.assets/content/scripts"


class EngineCoreSourceTests(unittest.TestCase):
    def test_native_topbar_always_attempted_when_flag_unavailable(self):
        starter = (ROOT / "StarterScript.lua").read_text(encoding="utf-8")
        self.assertIn("local useTopBar = true", starter)
        self.assertIn('scriptContext:AddCoreScriptLocal("CoreScripts/Topbar", RobloxGui)', starter)
        self.assertIn("if not topbarStarted then", starter)
        self.assertIn('scriptContext:AddCoreScriptLocal("CoreScripts/HealthScript", RobloxGui)', starter)
        self.assertIn("if not useTopBar then", starter)

    def test_chat_gui_initializes_with_topbar_without_chatmode_gating(self):
        topbar = (ROOT / "CoreScripts/Topbar.lua").read_text(encoding="utf-8")
        chat = (ROOT / "Modules/Chat.lua").read_text(encoding="utf-8")
        self.assertIn("local FORCE_CHAT_GUI = true", chat)
        self.assertIn("return true", chat[chat.index("local function GetTopBarFlag()"):chat.index("local function GetLuaChatFilteringFlag()")])
        self.assertIn("if enabled then -- 2x2: missing ChatMode", topbar)
        self.assertIn("ChatModule:TopbarEnabledChanged(topbarEnabled)", topbar)
        self.assertIn("ChatModule:ToggleVisibility()", topbar)

    def test_chat_object_scopes_and_idempotent_visibility(self):
        import re
        chat = (ROOT / "Modules/Chat.lua").read_text(encoding="utf-8")
        # The module constructs several widgets as 'this'; an unbound 'self'
        # previously broke focus, fade, message sending and visibility.
        live_source = "\n".join(line for line in chat.splitlines()
                                if not line.lstrip().startswith("--"))
        self.assertIsNone(re.search(r"\bself[.:]", live_source))
        self.assertIn('function this:ToggleVisibility(visible)', chat)
        self.assertIn('if type(visible) ~= "boolean" then', chat)
        self.assertIn('SetVisbility(visible)', chat)
        self.assertIn('function moduleApiTable:ToggleVisibility(visible)', chat)
        self.assertIn('ChatInstance:ToggleVisibility(visible)', chat)
        self.assertIn('return this.WidgetVisible and (chatCoreGuiEnabled or NON_CORESCRIPT_MODE)', chat)

    def test_topbar_chat_survives_missing_optional_services(self):
        topbar = (ROOT / "CoreScripts/Topbar.lua").read_text(encoding="utf-8")
        chat = (ROOT / "Modules/Chat.lua").read_text(encoding="utf-8")
        self.assertIn('local gotPlatform, platform = pcall(function()', topbar)
        self.assertIn('local loaded, ChatModule = pcall(function()', topbar)
        self.assertIn('if not loaded or not ChatModule then', topbar)
        self.assertIn('local bubbleChatIsOn = false', topbar)
        self.assertIn('local ok, err = pcall(function()', chat)
        self.assertIn('GuiRoot.Modules:WaitForChild("PlayerDropDown", 8)', chat)

    def test_topbar_does_not_hang_on_missing_settings(self):
        topbar = (ROOT / "CoreScripts/Topbar.lua").read_text(encoding="utf-8")
        self.assertIn('GuiRoot.Modules:WaitForChild("Settings", 8)', topbar)
        self.assertIn('settingsFolder:WaitForChild("SettingsHub", 8)', topbar)
        self.assertIn('warn("[2x2 topbar] SettingsHub', topbar)

    def test_both_health_modes_have_bounded_damage_overlay(self):
        for name in ("CoreScripts/HealthScript.lua", "CoreScripts/Topbar.lua"):
            with self.subTest(name=name):
                source = (ROOT / name).read_text(encoding="utf-8")
                self.assertNotIn("34854607", source)
                self.assertIn('Name = "HurtOverlay"', source)
                self.assertIn("BackgroundTransparency = 0.82", source)
                self.assertIn("hurtAnimation = hurtAnimation + 1", source)
                self.assertIn("UDim2.new(1,0,1,0)", source)


if __name__ == "__main__":
    unittest.main()
