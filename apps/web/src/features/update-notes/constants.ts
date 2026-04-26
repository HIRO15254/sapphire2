export { LATEST_VERSION, UPDATE_NOTES } from "virtual:update-notes";

export interface UpdateNote {
	readonly changes: readonly string[];
	readonly releasedAt: string;
	readonly title: string;
	readonly version: string;
}
