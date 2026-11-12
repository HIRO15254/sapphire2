import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { githubReleasesPlugin } from "./src/plugins/vite-plugin-github-releases";
import { tablerIconsPlugin } from "./src/plugins/vite-plugin-tabler-icons";
import { pwaManifest } from "./src/shared/lib/pwa-manifest";

const NOTO_SANS_JP_ASSET = /\/assets\/noto-sans-jp-.*\.woff2$/u;
const TABLER_ICONS_ASSET = /\/assets\/tabler-icons\..*\.woff2$/u;

export default defineConfig(({ mode }) => ({
	plugins: [
		githubReleasesPlugin(
			"hiro15254/sapphire2",
			mode === "test" ? [] : undefined
		),
		tablerIconsPlugin(),
		tailwindcss(),
		tanstackRouter({ autoCodeSplitting: true, target: "react" }),
		react(),
		VitePWA({
			devOptions: { enabled: false },
			manifest: pwaManifest,
			pwaAssets: { config: true, disabled: false },
			registerType: "prompt",
			workbox: {
				runtimeCaching: [
					{
						handler: "CacheFirst",
						options: {
							cacheableResponse: { statuses: [200] },
							cacheName: "noto-sans-jp",
							expiration: { maxAgeSeconds: 31_536_000, maxEntries: 128 },
						},
						urlPattern: NOTO_SANS_JP_ASSET,
					},
					{
						handler: "CacheFirst",
						options: {
							cacheableResponse: { statuses: [200] },
							cacheName: "tabler-icons",
							expiration: { maxAgeSeconds: 31_536_000, maxEntries: 64 },
						},
						urlPattern: TABLER_ICONS_ASSET,
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	server: {
		port: 3001,
	},
}));
