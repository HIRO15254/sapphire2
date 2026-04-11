declare module "virtual:update-notes" {
	export const UPDATE_NOTES: Array<{
		version: string;
		releasedAt: string;
		title: string;
		changes: string[];
	}>;
	export const LATEST_VERSION: string | null;
}
