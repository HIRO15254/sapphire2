export interface UpdateNote {
	readonly changes: readonly string[];
	readonly releasedAt: string;
	readonly title: string;
	readonly version: string;
}

export const UPDATE_NOTES: readonly UpdateNote[] = [
	{
		version: "1.0.0",
		releasedAt: "2026-04-11",
		title: "Update Notes Feature",
		changes: [
			"Added update notes modal to view past release information",
			"Unviewed updates are highlighted with a NEW badge",
			"Update notes sheet automatically opens after a new release",
		],
	},
] as const;

export const LATEST_VERSION = UPDATE_NOTES[0]?.version ?? null;
