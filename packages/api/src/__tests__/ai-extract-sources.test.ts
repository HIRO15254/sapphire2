import { describe, expect, it } from "vitest";
import {
	TABLE_PLAYER_SOURCE_APP_IDS,
	TABLE_PLAYER_SOURCE_APPS,
} from "../routers/ai-extract-sources";

const SEAT_RE = /seat/i;
const CLOCKWISE_RE = /clockwise/i;
const IS_HERO_RE = /isHero/;
const NULL_RE = /null/;
const OMIT_RE = /omit/i;

describe("ai-extract-sources constants", () => {
	it("exposes dmm_waitinglist as the only known source app id", () => {
		expect(TABLE_PLAYER_SOURCE_APP_IDS).toEqual(["dmm_waitinglist"]);
	});

	it("TABLE_PLAYER_SOURCE_APP_IDS is a readonly tuple", () => {
		// `as const` produces a frozen-like readonly tuple at the type level.
		// Runtime: ensure the array does not accidentally contain stray ids.
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

	it("dmm_waitinglist prompt mentions seat numbering convention", () => {
		const prompt = TABLE_PLAYER_SOURCE_APPS.dmm_waitinglist.prompt;
		expect(prompt).toMatch(SEAT_RE);
		expect(prompt).toMatch(CLOCKWISE_RE);
	});

	it("dmm_waitinglist prompt includes hero detection guidance", () => {
		const prompt = TABLE_PLAYER_SOURCE_APPS.dmm_waitinglist.prompt;
		expect(prompt).toMatch(IS_HERO_RE);
		expect(prompt).toMatch(NULL_RE);
	});

	it("dmm_waitinglist prompt instructs to omit empty/unreadable seats", () => {
		const prompt = TABLE_PLAYER_SOURCE_APPS.dmm_waitinglist.prompt;
		expect(prompt).toMatch(OMIT_RE);
	});

	it("exactly as many config entries as ids", () => {
		expect(Object.keys(TABLE_PLAYER_SOURCE_APPS).sort()).toEqual(
			[...TABLE_PLAYER_SOURCE_APP_IDS].sort()
		);
	});
});
