import { describe, expect, it } from "vitest";
import {
	TABLE_PLAYER_SOURCE_APP_IDS,
	TABLE_PLAYER_SOURCE_APPS,
} from "../routers/ai-extract-sources";

describe("ai-extract-sources constants", () => {
	it("exposes dmm_waitinglist as the only known source app id", () => {
		expect(TABLE_PLAYER_SOURCE_APP_IDS).toEqual(["dmm_waitinglist"]);
	});

	it("labels the dmm_waitinglist config as 'DMM Waitinglist'", () => {
		expect(TABLE_PLAYER_SOURCE_APPS.dmm_waitinglist.label).toBe(
			"DMM Waitinglist"
		);
	});
});
