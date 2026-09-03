import type { ManifestOptions } from "vite-plugin-pwa";

export const pwaManifest: Partial<ManifestOptions> = {
	name: "sapphire2",
	short_name: "sapphire2",
	description: "sapphire2 - PWA Application",
	theme_color: "#0c0c0c",
	start_url: "/",
};
