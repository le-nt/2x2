# 2x2 modern theme ("2017, if it never went corporate")

- `css/modern.css` - the whole look. Loaded after `site.css` and `retro.css` on every page (retro.css is now just a base layer; delete it if you like, nothing depends on it visually).
- `js/motion.js` - scroll reveal, card tilt/glare, wallet count-up, the landing brick scene. Respects reduced-motion and Settings -> interface motion.
- `css/fonts/` - Source Sans 3 (the typeface 2017 Roblox used), self-hosted so COEP is happy.
- `img/mark.svg` - new logo mark (also inlined by `RB.brick()` in `common.js`). The old globe PNG is no longer referenced.
- `effects.js` - the purple WebGL shader panels are switched off (sounds and settings still work).
- Light theme is still the default for new visitors, dark is one click in Settings. The landing page is always dark.

## Optional Sunny Day icons (Iconshock)
Drop PNGs (48 or 72 px) into `img/icons/` using these names and they replace the line icons in the sidebar automatically; a credit link appears in the footer only when one loads:
home, games, shopping_cart, user, group, chat, speech_balloon, book, gear, info
Free tier = personal use + attribution. Commercial use needs their paid license.
