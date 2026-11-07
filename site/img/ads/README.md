# Community advertisements in 2x2

The website supports these local folders:

- `site/img/ads/` — existing/legacy community artwork (still supported).
- `site/img/userads/skyscraper/` — original 160 x 600 side-rail images.
- `site/img/userads/banner/` — original 728 x 90 or 727 x 90 leaderboard ads.
- `site/img/userads/rectangle/` — original 300 x 250 rectangle ads.
- `site/img/userads/feature/` — original 800 x 600 artwork, shown without cropping.

Use `py tools/install-userads.py --root "C:\\RBXBanland" --archive "C:\\path\\coolpeterm-roblox-ads.zip"` to import the supplied historical archive. It sorts by PNG dimensions, preserves the original image bytes, and never modifies existing artwork or native client binaries.

The `/api/ads` endpoint discovers the images automatically, cached for 15 seconds, and reports each entry's category and dimensions. Existing `images` consumers remain supported. 2x2 displays 160 x 600 skyscraper images in desktop rails, banners above page content (including individual game pages), and 300 x 250 / 800 x 600 artwork in correctly shaped slots in the game detail sidebar. Ads use `object-fit: contain`, not `cover`, to avoid cutting off archived text and drawings.

The project does not fetch external ads or use ad tracking.
