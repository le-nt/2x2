import presetMini from "@unocss/preset-mini"
import { defineConfig } from "unocss"

export default defineConfig({
    presets: [presetMini()],
    extendTheme: (theme) => {
        return {
            ...theme,
            breakpoints: {
                ...theme.breakpoints,
                xs: "480px",
                sm: "768px",
                md: "992px",
                lg: "1200px",
                xl: "1360px",
                "2xl": "1688px"
            },
        }
    },
    content: {
        pipeline: {
            include: [
                "src/lib/client/admin_nav.ts",
                /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
            ]
        }
    }
})