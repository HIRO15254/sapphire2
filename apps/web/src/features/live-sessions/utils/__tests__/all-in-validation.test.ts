import { describe, expect, it, vi } from "vitest";
import { refineWinsNotExceedingTrials } from "@/features/live-sessions/utils/all-in-validation";

type RefineCtx = Parameters<typeof refineWinsNotExceedingTrials>[1];

function run(value: { trials: string; wins: string }) {
	const addIssue = vi.fn();
	refineWinsNotExceedingTrials(value, { addIssue } as unknown as RefineCtx);
	return addIssue;
}

const WINS_EXCEEDS_ISSUE = {
	code: "custom",
	message: "Wins must not exceed trials",
	path: ["wins"],
};

describe("refineWinsNotExceedingTrials", () => {
	it("flags wins greater than trials on the wins field path", () => {
		const addIssue = run({ trials: "1", wins: "2" });
		expect(addIssue).toHaveBeenCalledTimes(1);
		expect(addIssue).toHaveBeenCalledWith(WINS_EXCEEDS_ISSUE);
	});

	it("flags wins exceeding trials by exactly one (off-by-one boundary)", () => {
		const addIssue = run({ trials: "3", wins: "4" });
		expect(addIssue).toHaveBeenCalledTimes(1);
	});

	it("flags a fractional wins that still exceeds trials", () => {
		const addIssue = run({ trials: "1", wins: "1.5" });
		expect(addIssue).toHaveBeenCalledTimes(1);
	});

	it("accepts wins equal to trials (upper boundary)", () => {
		expect(run({ trials: "3", wins: "3" })).not.toHaveBeenCalled();
	});

	it("accepts wins less than trials", () => {
		expect(run({ trials: "3", wins: "1" })).not.toHaveBeenCalled();
	});

	it("accepts a fractional wins within trials (a chopped pot)", () => {
		expect(run({ trials: "3", wins: "1.5" })).not.toHaveBeenCalled();
	});

	it("ignores an empty wins (left to the field-level rule)", () => {
		expect(run({ trials: "1", wins: "" })).not.toHaveBeenCalled();
	});

	it("ignores a non-numeric wins", () => {
		expect(run({ trials: "1", wins: "abc" })).not.toHaveBeenCalled();
	});

	it("ignores a non-numeric trials (no comparison possible)", () => {
		expect(run({ trials: "abc", wins: "5" })).not.toHaveBeenCalled();
	});

	it.each([
		"",
		"0",
		"-1",
		"1.5",
		"1abc",
		"Infinity",
	])("ignores invalid trials %j instead of adding a second-field error", (trials) => {
		expect(run({ trials, wins: "5" })).not.toHaveBeenCalled();
	});

	it("trims surrounding whitespace before comparing", () => {
		expect(run({ trials: " 3 ", wins: " 4 " })).toHaveBeenCalledTimes(1);
	});
});
