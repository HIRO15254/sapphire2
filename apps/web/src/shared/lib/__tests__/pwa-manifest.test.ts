import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pwaManifest } from "../pwa-manifest";

/**
 * Regression guard for SA2-163: the PWA manifest `start_url` must resolve to a
 * route that actually exists in the generated route tree. The bug was
 * `start_url: "/dashboard"`, a route removed in PR #341/#363 — launching the
 * installed PWA landed on TanStack Router's not-found shell.
 *
 * Instead of hard-coding the expected path we derive the set of real routes
 * from `src/routeTree.gen.ts` (the generated source of truth) so this test
 * keeps working as routes come and go, and fails the moment `start_url` points
 * anywhere the router can't serve.
 */
function readGeneratedRoutePaths(): Set<string> {
	const routeTreePath = path.resolve(
		import.meta.dirname,
		"../../../routeTree.gen.ts"
	);
	const source = readFileSync(routeTreePath, "utf8");
	const paths = new Set<string>();
	const pathLiteral = /(?:full)?[Pp]ath:\s*'([^']+)'/g;
	let match = pathLiteral.exec(source);
	while (match !== null) {
		paths.add(match[1]);
		match = pathLiteral.exec(source);
	}
	return paths;
}

describe("pwaManifest", () => {
	const routePaths = readGeneratedRoutePaths();

	it("derives a non-empty route-path set from the generated route tree", () => {
		// Sanity: the regex must actually find routes, otherwise the guard below
		// would pass vacuously.
		expect(routePaths.size).toBeGreaterThan(0);
		expect(routePaths.has("/")).toBe(true);
	});

	it("points start_url at a route that exists in the generated route tree", () => {
		expect(routePaths.has(pwaManifest.start_url as string)).toBe(true);
	});

	it("uses '/' — the only always-reachable entry point after the dashboard removal", () => {
		expect(pwaManifest.start_url).toBe("/");
	});

	it("does not point start_url at the removed /dashboard route", () => {
		// Documents the SA2-163 root cause: /dashboard is no longer in the tree,
		// so it must never be the launch target again.
		expect(routePaths.has("/dashboard")).toBe(false);
		expect(pwaManifest.start_url).not.toBe("/dashboard");
	});
});
