import { afterEach, describe, expect, it, vi } from "vitest";
import { githubReleasesPlugin } from "../vite-plugin-github-releases";

const RELEASE_DATE = /"releasedAt":\s*"2026-04-01"/;
const RELEASE_TITLE = /"title":\s*"Test release"/;

const fixture = [
	{
		body: "## Improvements\n- Faster session entry",
		draft: false,
		name: "Test release",
		prerelease: false,
		published_at: "2026-04-01T23:00:00Z",
		tag_name: "v1.2.3",
	},
];

async function loadNotes(releases = fixture) {
	const plugin = githubReleasesPlugin("example/app", releases);
	const load = plugin.load as (id: string) => Promise<string | undefined>;
	return await load("\0virtual:update-notes");
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("test build release notes", () => {
	it("builds stable release exports without accessing GitHub", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValue(new Error("network unavailable"));
		vi.stubGlobal("fetch", fetchMock);
		const source = await loadNotes();
		expect(source).toContain('export const LATEST_VERSION = "v1.2.3"');
		expect(source).toMatch(RELEASE_DATE);
		expect(source).toMatch(RELEASE_TITLE);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("supports an empty fixture without falling back to the network", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValue(new Error("network unavailable"));
		vi.stubGlobal("fetch", fetchMock);
		expect(await loadNotes([])).toBe(
			"export const UPDATE_NOTES = [];\nexport const LATEST_VERSION = null;"
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

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
