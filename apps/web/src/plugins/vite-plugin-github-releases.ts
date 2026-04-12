import type { Plugin } from "vite";

interface GitHubRelease {
	body: string | null;
	draft: boolean;
	name: string | null;
	prerelease: boolean;
	published_at: string | null;
	tag_name: string;
}

interface UpdateNote {
	changes: string[];
	releasedAt: string;
	title: string;
	version: string;
}

const LIST_ITEM_PREFIX = /^[-*]\s+/;

function parseReleaseBody(body: string | null): string[] {
	if (!body) {
		return [];
	}
	return body
		.split("\n")
		.map((line) => line.replace(LIST_ITEM_PREFIX, "").trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"));
}

async function fetchGitHubReleases(repo: string): Promise<UpdateNote[]> {
	const url = `https://api.github.com/repos/${repo}/releases?per_page=50`;
	const res = await fetch(url, {
		headers: { Accept: "application/vnd.github.v3+json" },
	});

	if (!res.ok) {
		console.warn(
			`[github-releases] Failed to fetch releases (${res.status}). Using empty list.`
		);
		return [];
	}

	const releases: GitHubRelease[] = await res.json();

	return releases
		.filter((r) => !r.draft)
		.map((r) => ({
			version: r.tag_name,
			releasedAt: r.published_at
				? r.published_at.split("T")[0]
				: new Date().toISOString().split("T")[0],
			title: r.name || r.tag_name,
			changes: parseReleaseBody(r.body),
		}));
}

const VIRTUAL_MODULE_ID = "virtual:update-notes";
const RESOLVED_ID = `\0${VIRTUAL_MODULE_ID}`;

export function githubReleasesPlugin(repo: string): Plugin {
	let cachedNotes: UpdateNote[] | null = null;

	return {
		name: "vite-plugin-github-releases",

		resolveId(id) {
			if (id === VIRTUAL_MODULE_ID) {
				return RESOLVED_ID;
			}
		},

		async load(id) {
			if (id !== RESOLVED_ID) {
				return;
			}

			if (!cachedNotes) {
				cachedNotes = await fetchGitHubReleases(repo);
				if (cachedNotes.length > 0) {
					console.log(
						`[github-releases] Loaded ${cachedNotes.length} releases from ${repo}`
					);
				} else {
					console.log(
						`[github-releases] No releases found for ${repo}. Update notes will be empty.`
					);
				}
			}

			return `export const UPDATE_NOTES = ${JSON.stringify(cachedNotes, null, 2)};
export const LATEST_VERSION = ${cachedNotes.length > 0 ? JSON.stringify(cachedNotes[0].version) : "null"};`;
		},
	};
}
