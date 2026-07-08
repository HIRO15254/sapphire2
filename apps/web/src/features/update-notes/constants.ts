export { LATEST_VERSION, UPDATE_NOTES } from "virtual:update-notes";

export interface UpdateNoteChangeSection {
	readonly items: readonly string[];
	readonly section: string;
}

export interface UpdateNote {
	readonly changes: readonly UpdateNoteChangeSection[];
	readonly releasedAt: string;
	readonly title: string;
	readonly version: string;
}
