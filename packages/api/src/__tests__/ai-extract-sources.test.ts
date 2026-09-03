import { describe, expect, it } from "vitest";
import {
	TABLE_PLAYER_SOURCE_APP_IDS,
	TABLE_PLAYER_SOURCE_APPS,
} from "../routers/ai-extract-sources";

describe("ai-extract-sources constants", () => {
	it("exposes dmm_waitinglist as the only known source app id", () => {
		expect(TABLE_PLAYER_SOURCE_APP_IDS).toEqual(["dmm_waitinglist"]);
	});

	it("TABLE_PLAYER_SOURCE_APP_IDS is a readonly tuple", () => {
		expect(TABLE_PLAYER_SOURCE_APP_IDS).toHaveLength(1);
	});

	it("provides a config entry for every id in TABLE_PLAYER_SOURCE_APP_IDS", () => {
		for (const id of TABLE_PLAYER_SOURCE_APP_IDS) {
			const cfg = TABLE_PLAYER_SOURCE_APPS[id];
			expect(cfg).toBeDefined();
			expect(typeof cfg.label).toBe("string");
			expect(cfg.label.length).toBeGreaterThan(0);
			expect(typeof cfg.prompt).toBe("string");
			expect(cfg.prompt.length).toBeGreaterThan(0);
		}
	});

	it("exactly as many config entries as ids", () => {
		expect(Object.keys(TABLE_PLAYER_SOURCE_APPS).sort()).toEqual(
			[...TABLE_PLAYER_SOURCE_APP_IDS].sort()
		);
	});
});
