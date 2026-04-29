import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
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

describe("UpdateNoteView — FKs, indexes, defaults", () => {
	const config = getTableConfig(updateNoteView);
	const columns = getTableColumns(updateNoteView);

	it("userId FK cascades on user deletion", () => {
		const fk = config.foreignKeys.find((f) =>
			f.reference().columns.some((c) => c.name === "user_id")
		);
		expect(fk?.onDelete).toBe("cascade");
	});

	it("userId FK references user.id", () => {
		const fk = config.foreignKeys.find((f) =>
			f.reference().columns.some((c) => c.name === "user_id")
		);
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});

	it("has a plain userId index", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("update_note_view_user_id_idx");
	});

	it("has a UNIQUE composite index on (userId, version) to prevent duplicate views", () => {
		const uniqueIdx = config.indexes.find(
			(i) =>
				i.config.name === "update_note_view_user_version_idx" &&
				(i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdx).toBeDefined();
		const cols = (
			uniqueIdx?.config.columns as unknown as { name?: string }[]
		).map((c) => c.name);
		expect(cols).toEqual(["user_id", "version"]);
	});

	it("has exactly one unique index", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(1);
	});

	it("viewedAt has a default (unixepoch)", () => {
		expect(columns.viewedAt.hasDefault).toBe(true);
	});

	it("viewedAt uses timestamp mode", () => {
		expect(columns.viewedAt.dataType).toBe("date");
	});

	it("version is stored as string (semver / label)", () => {
		expect(columns.version.dataType).toBe("string");
		expect(columns.version.notNull).toBe(true);
	});

	it("has no composite primary key (uniqueness is via index)", () => {
		expect(config.primaryKeys).toHaveLength(0);
	});
});
