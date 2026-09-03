import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pwaManifest } from "../pwa-manifest";

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
		expect(routePaths.has("/dashboard")).toBe(false);
		expect(pwaManifest.start_url).not.toBe("/dashboard");
	});
});
