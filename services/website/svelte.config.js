import adapter from "svelte-adapter-bun";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: [vitePreprocess()],
  kit: {
    // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapter(),
    alias: {
      "@/types/*": "./src/lib/types/*",
      "@/*": "./src/lib/server/*",
      "@client/*": "./src/lib/client/*",
      "@shared/*": "./src/lib/shared/*",
      "@sherlock/*": "./src/lib/client/sherlock/*",
      "@components/*": "./src/components/*",
      "@assets/*": "./src/lib/assets/*",
    },
  },
  runes: true,
};

export default config;
