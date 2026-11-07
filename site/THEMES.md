# 2x2 — 2016 remix

The exact supplied globe emblem is `img/logo-2x2.png`. Purple/magenta/cyan accents surround light gray pages and square white panels; dark mode remains available. `rb.siteTheme` keeps explicit `light` or `dark` selections. New visitors default to light.

`css/site.css` is the application base. `css/retro.css` loads last and supplies the 2016-inspired styling. `js/effects.js` provides WebGL brand panels, synthesized retro UI sounds and controls; it uses no third-party scripts or fonts.

Settings → Sounds & effects controls sound, volume, shader backgrounds and interface motion. The header speaker toggles sound. Preferences use `2x2.experience.v1` in localStorage. Browser autoplay rules require a user interaction before sound. System reduced-motion preference overrides interface animation.

Shader fallback is a CSS gradient. Turning off shaders does not change gameplay or disable the game renderer. Interface volume does not change game volume.
