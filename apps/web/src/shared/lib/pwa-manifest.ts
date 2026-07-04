import type { ManifestOptions } from "vite-plugin-pwa";

/**
 * PWA manifest, extracted into its own module so it can be unit-tested
 * independently of `vite.config.ts` (importing the config would pull in the
 * whole Vite plugin graph).
 *
 * `start_url` MUST reference a route that actually exists in the generated
 * route tree (`src/routeTree.gen.ts`). The previous value `"/dashboard"`
 * pointed at a route removed in PR #341 (and cleanup #363), so a PWA launched
 * from the home screen landed on TanStack Router's not-found shell (blank/404).
 * `"/"` is the only always-reachable entry point: the index route dispatches
 * signed-in users to `/statistics` and everyone else to `/login`.
 */
export const pwaManifest: Partial<ManifestOptions> = {
	name: "sapphire2",
	short_name: "sapphire2",
	description: "sapphire2 - PWA Application",
	theme_color: "#0c0c0c",
	start_url: "/",
};
