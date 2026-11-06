import { expect, it } from "vitest";
import {
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

it("backfills hand sequences in hand number order per session", () => {
	const db = openDatabase();
	try {
		for (const file of migrationFiles("0079_")) {
			for (const sql of statementsOf(file)) {
				db.exec(sql);
			}
		}
		db.exec(`INSERT INTO play_session (id,user_id,entry_id,kind,seq,local_date,status,end_state,end_stack,updated_at) VALUES ('s','u','e','cash',1,'2026-01-01','ended','cashed_out',0,1),('t','u','f','cash',1,'2026-01-01','ended','cashed_out',0,1),('empty','u','g','cash',1,'2026-01-01','ended','cashed_out',0,1);
INSERT INTO hand (id,user_id,play_session_id,hand_no,detail,updated_at) VALUES ('b','u','s',2,'count',1),('a','u','s',1,'count',1),('c','u','t',1,'count',1);`);
		for (const sql of statementsOf("0079_hand_seq_backfill.sql")) {
			db.exec(sql);
		}
		expect(
			rowValues(db.prepare("SELECT id,seq FROM hand ORDER BY id"))
		).toEqual([
			["a", 1],
			["b", 2],
			["c", 1],
		]);
		expect(
			rowValues(
				db.prepare("SELECT id,next_hand_seq FROM play_session ORDER BY id")
			)
		).toEqual([
			["empty", 0],
			["s", 2],
			["t", 1],
		]);
		expect(() =>
			db.exec(
				"INSERT INTO hand (id,user_id,play_session_id,hand_no,seq,detail,updated_at) VALUES ('d','u','s',3,2,'count',1)"
			)
		).toThrow("UNIQUE");
	} finally {
		db.close();
	}
});
