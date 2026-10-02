import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { githubReleasesPlugin } from "./src/plugins/vite-plugin-github-releases";
import { pwaManifest } from "./src/shared/lib/pwa-manifest";

const NOTO_SANS_JP_ASSET = /\/assets\/noto-sans-jp-.*\.woff2$/;

export default defineConfig(({ mode }) => ({
	plugins: [
		githubReleasesPlugin(
			"hiro15254/sapphire2",
			mode === "test" ? [] : undefined
		),
		tailwindcss(),
		tanstackRouter({}),
		react(),
		VitePWA({
			registerType: "prompt",
			manifest: pwaManifest,
			pwaAssets: { disabled: false, config: true },
			devOptions: { enabled: false },
			workbox: {
				runtimeCaching: [
					{
						urlPattern: NOTO_SANS_JP_ASSET,
						handler: "CacheFirst",
						options: {
							cacheName: "noto-sans-jp",
							cacheableResponse: { statuses: [200] },
							expiration: { maxEntries: 128, maxAgeSeconds: 31_536_000 },
						},
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
