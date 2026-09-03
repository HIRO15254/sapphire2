import { describe, expect, it } from "vitest";
import { sessionEvent } from "../schema/session-event";
import { fkByColumn, indexByName, indexesOf } from "./test-utils";

describe("SessionEvent — FK cascade policies", () => {
	it("sessionId FK cascades so events die with their session", () => {
		expect(fkByColumn(sessionEvent, "session_id")).toEqual({
			columns: ["session_id"],
			foreignColumns: ["id"],
			foreignTable: "game_session",
			onDelete: "cascade",
		});
	});
});

describe("SessionEvent — indexes", () => {
	it("indexes eventType for filtering by event kind", () => {
		expect(indexesOf(sessionEvent).filter((index) => !index.unique)).toEqual([
			{
				columns: ["event_type"],
				name: "sessionEvent_eventType_idx",
				unique: false,
				where: null,
			},
		]);
	});

	it("allows only one event per (session_id, sort_order) so append ordering is stable", () => {
		expect(
			indexByName(sessionEvent, "sessionEvent_sessionId_sortOrder_idx")
		).toEqual({
			columns: ["session_id", "sort_order"],
			name: "sessionEvent_sessionId_sortOrder_idx",
			unique: true,
			where: null,
		});
	});
});
