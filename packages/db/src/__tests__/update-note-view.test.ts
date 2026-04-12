import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { updateNoteView } from "../schema/update-note-view";

describe("UpdateNoteView schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(updateNoteView);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.version).toBeDefined();
		expect(columns.viewedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(updateNoteView);
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		const columns = getTableColumns(updateNoteView);
		expect(columns.userId.notNull).toBe(true);
	});

	it("version is not null", () => {
		const columns = getTableColumns(updateNoteView);
		expect(columns.version.notNull).toBe(true);
	});

	it("viewedAt is not null", () => {
		const columns = getTableColumns(updateNoteView);
		expect(columns.viewedAt.notNull).toBe(true);
	});
});
