import { describe, expect, it } from "vitest";
import { updateNoteView } from "../schema/update-note-view";
import { fkByColumn, indexByName, indexesOf } from "./test-utils";

describe("UpdateNoteView — FKs and indexes", () => {
	it("userId FK cascades so view records die with their owner", () => {
		expect(fkByColumn(updateNoteView, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});

	it("indexes userId for per-user view lookups", () => {
		expect(indexesOf(updateNoteView)).toEqual(
			expect.arrayContaining([
				{
					columns: ["user_id"],
					name: "update_note_view_user_id_idx",
					unique: false,
					where: null,
				},
			])
		);
	});

	it("uniquely indexes (userId, version) to prevent duplicate views", () => {
		expect(
			indexByName(updateNoteView, "update_note_view_user_version_idx")
		).toEqual({
			columns: ["user_id", "version"],
			name: "update_note_view_user_version_idx",
			unique: true,
			where: null,
		});
	});
});
