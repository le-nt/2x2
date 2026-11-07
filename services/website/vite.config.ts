import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import extractorSvelte from "@unocss/extractor-svelte"
import UnoCSS from "unocss/vite"

export default defineConfig({
	plugins: [UnoCSS({ extractors: [extractorSvelte()] }), sveltekit()],
	server: {
		allowedHosts: ["roblox.loc", "www.roblox.loc", "clientsettingscdn.roblox.loc", "cdn.2x2"],
	},
	assetsInclude: ["**/*.rbxl"],
	resolve: {
		alias: {
			".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js"
		}
	}
});



