import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { githubReleasesPlugin } from "./src/plugins/vite-plugin-github-releases";

export default defineConfig({
	plugins: [
		githubReleasesPlugin("hiro15254/sapphire2"),
		tailwindcss(),
		tanstackRouter({}),
		react(),
		VitePWA({
			registerType: "autoUpdate",
			manifest: {
				name: "sapphire2",
				short_name: "sapphire2",
				description: "sapphire2 - PWA Application",
				theme_color: "#0c0c0c",
			},
			pwaAssets: { disabled: false, config: true },
			devOptions: { enabled: true },
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
});
