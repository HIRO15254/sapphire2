declare module "virtual:update-notes" {
	export const UPDATE_NOTES: Array<{
		version: string;
		releasedAt: string;
		title: string;
		changes: import("./features/update-notes/utils/parse-release-body").UpdateNoteSection[];
	}>;
	export const LATEST_VERSION: string | null;
}
