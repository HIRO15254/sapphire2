import type { ManifestOptions } from "vite-plugin-pwa";

export const pwaManifest: Partial<ManifestOptions> = {
	description: "sapphire2 - PWA Application",
	name: "sapphire2",
	short_name: "sapphire2",
	start_url: "/",
	theme_color: "#08090a",
};
