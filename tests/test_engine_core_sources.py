"""Prevent recurring source-level chat and hurt-overlay regressions.

These are source checks, not evidence that a rebuilt WebClient was tested.
"""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/'services/engine/.assets/content/scripts'

class EngineCoreSourceTests(unittest.TestCase):
    def test_chat_does_not_require_topbar_flag(self):
        content=(ROOT/'StarterScript.lua').read_text(encoding='utf-8')
        chat=content.index('require(RobloxGui.Modules:WaitForChild("Chat"))')
        branch=content.index('if useTopBar then',content.index('-- Chat must be initialized'))
        self.assertLess(chat,branch)
    def test_both_health_modes_have_offline_overlay(self):
        for name in ('CoreScripts/HealthScript.lua','CoreScripts/Topbar.lua'):
            with self.subTest(name=name):
                source=(ROOT/name).read_text(encoding='utf-8')
                self.assertNotIn('34854607',source)
                self.assertIn('Name = "HurtOverlay"',source)
                self.assertIn('BackgroundTransparency = 0.82',source)

if __name__=='__main__':
    unittest.main()
