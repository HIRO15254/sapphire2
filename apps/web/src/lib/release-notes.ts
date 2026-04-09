import { z } from "zod";

const releaseNoteEntrySchema = z.object({
	title: z.string(),
	summary: z.string(),
	additions: z.array(z.string()).optional(),
});

export const latestReleaseNotesSchema = z.object({
	version: z.string(),
	releasedAt: z.string(),
	changes: z.object({
		user: z.array(releaseNoteEntrySchema),
		developer: z.array(releaseNoteEntrySchema),
	}),
});

export type LatestReleaseNotes = z.infer<typeof latestReleaseNotesSchema>;

export const latestReleaseNotesQueryKey = ["release-notes", "latest"] as const;
export const lastSeenReleaseVersionStorageKey =
	"sapphire2:last-seen-release-version";

export async function fetchLatestReleaseNotes() {
	const response = await fetch("/release-notes/latest.json", {
		headers: {
			accept: "application/json",
		},
	});

	if (!response.ok) {
		throw new Error("Failed to load release notes");
	}

	const json = await response.json();
	return latestReleaseNotesSchema.parse(json);
}
