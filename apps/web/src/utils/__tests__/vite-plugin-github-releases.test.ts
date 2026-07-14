import { afterEach, describe, expect, it, vi } from "vitest";
import { githubReleasesPlugin } from "@/plugins/vite-plugin-github-releases";

const RESOLVED_ID = "\0virtual:update-notes";

function release(overrides: Record<string, unknown> = {}) {
	return {
		body: "## Added\n- Feature",
		draft: false,
		name: "Version 1.0.0",
		prerelease: false,
		published_at: "2026-07-14T00:00:00Z",
		tag_name: "v1.0.0",
		...overrides,
	};
}

async function loadVirtualModule() {
	const plugin = githubReleasesPlugin("HIRO15254/sapphire2");
	const load = plugin.load as (id: string) => Promise<string | undefined>;
	return await load(RESOLVED_ID);
}

describe("githubReleasesPlugin", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it("excludes draft and prerelease entries from notes and latest version", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(
						JSON.stringify([
							release({ tag_name: "v2.0.0-rc.1", prerelease: true }),
							release({ tag_name: "v1.5.0", draft: true }),
							release({ tag_name: "v1.0.0" }),
						]),
						{ status: 200 }
					)
				)
		);

		const source = await loadVirtualModule();
		expect(source).toContain('export const LATEST_VERSION = "v1.0.0"');
		expect(source).toContain('"version": "v1.0.0"');
		expect(source).not.toContain("v2.0.0-rc.1");
		expect(source).not.toContain("v1.5.0");
	});

	it("sends the workflow token as a bearer credential", async () => {
		vi.stubEnv("GITHUB_TOKEN", "test-token");
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify([release()]), { status: 200 })
			);
		vi.stubGlobal("fetch", fetchMock);

		await loadVirtualModule();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.github.com/repos/HIRO15254/sapphire2/releases?per_page=50",
			{
				headers: {
					Accept: "application/vnd.github.v3+json",
					Authorization: "Bearer test-token",
				},
			}
		);
	});

	it("fails the build when GitHub returns a non-success response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("rate limited", { status: 403 }))
		);

		await expect(loadVirtualModule()).rejects.toThrow(
			"Failed to fetch releases (403)"
		);
	});
});
