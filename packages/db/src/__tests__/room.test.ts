import { describe, expect, it } from "vitest";
import { room } from "../schema/room";
import { fkByColumn, indexesOf } from "./test-utils";

describe("Room — FKs and indexes", () => {
	it("userId FK cascades so rooms die with their owner", () => {
		expect(fkByColumn(room, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});

	it("indexes userId for per-user room lookups", () => {
		expect(indexesOf(room)).toEqual([
			{
				columns: ["user_id"],
				name: "room_userId_idx",
				unique: false,
				where: null,
			},
		]);
	});
});
