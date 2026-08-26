import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStackQuickInput } from "../use-stack-quick-input";

const NOW = new Date(2026, 7, 26, 12, 0, 0);

function setup(
	overrides: Partial<Parameters<typeof useStackQuickInput>[0]> = {}
) {
	const onRecordStack = vi.fn();
	const { result } = renderHook(() =>
		useStackQuickInput({
			defaultRemainingPlayers: null,
			defaultTotalEntries: null,
			kind: "cash_game",
			lastStackUpdatedAt: null,
			onRecordStack,
			...overrides,
		})
	);
	return { result, onRecordStack };
}

async function submit(result: ReturnType<typeof setup>["result"]) {
	await act(async () => {
		await result.current.form.handleSubmit();
	});
}

describe("useStackQuickInput — default field values", () => {
	it("starts with an empty stack field", () => {
		const { result } = setup();
		expect(result.current.form.state.values.stackAmount).toBe("");
	});

	it("seeds remainingPlayers and totalEntries from numeric defaults", () => {
		const { result } = setup({
			defaultRemainingPlayers: 42,
			defaultTotalEntries: 128,
		});
		expect(result.current.form.state.values.remainingPlayers).toBe("42");
		expect(result.current.form.state.values.totalEntries).toBe("128");
	});

	it("treats null defaults as empty players fields", () => {
		const { result } = setup({
			defaultRemainingPlayers: null,
			defaultTotalEntries: null,
		});
		expect(result.current.form.state.values.remainingPlayers).toBe("");
		expect(result.current.form.state.values.totalEntries).toBe("");
	});

	it("treats undefined defaults as empty players fields", () => {
		const { result } = setup({
			defaultRemainingPlayers: undefined,
			defaultTotalEntries: undefined,
		});
		expect(result.current.form.state.values.remainingPlayers).toBe("");
		expect(result.current.form.state.values.totalEntries).toBe("");
	});
});

describe("useStackQuickInput — submit mapping", () => {
	it("maps stackAmount, remainingPlayers and totalEntries exactly", async () => {
		const { result, onRecordStack } = setup({ kind: "tournament" });
		act(() => {
			result.current.form.setFieldValue("stackAmount", "51800");
			result.current.form.setFieldValue("remainingPlayers", "42");
			result.current.form.setFieldValue("totalEntries", "128");
		});
		await submit(result);
		expect(onRecordStack).toHaveBeenCalledTimes(1);
		expect(onRecordStack).toHaveBeenNthCalledWith(1, {
			stackAmount: 51_800,
			remainingPlayers: 42,
			totalEntries: 128,
		});
	});

	it("omits both optionals when they are absent for a tournament", async () => {
		const { result, onRecordStack } = setup({ kind: "tournament" });
		act(() => {
			result.current.form.setFieldValue("stackAmount", "20000");
		});
		await submit(result);
		expect(onRecordStack).toHaveBeenCalledTimes(1);
		const [payload] = onRecordStack.mock.calls[0];
		expect(payload).toEqual({ stackAmount: 20_000 });
		expect("remainingPlayers" in payload).toBe(false);
		expect("totalEntries" in payload).toBe(false);
	});

	it("omits remainingPlayers and totalEntries for cash_game", async () => {
		const { result, onRecordStack } = setup({ kind: "cash_game" });
		act(() => {
			result.current.form.setFieldValue("stackAmount", "15000");
		});
		await submit(result);
		expect(onRecordStack).toHaveBeenNthCalledWith(1, { stackAmount: 15_000 });
	});

	it("includes only remainingPlayers when totalEntries is blank", async () => {
		const { result, onRecordStack } = setup({ kind: "tournament" });
		act(() => {
			result.current.form.setFieldValue("stackAmount", "9000");
			result.current.form.setFieldValue("remainingPlayers", "5");
		});
		await submit(result);
		expect(onRecordStack).toHaveBeenNthCalledWith(1, {
			stackAmount: 9000,
			remainingPlayers: 5,
		});
	});

	it("includes only totalEntries when remainingPlayers is blank", async () => {
		const { result, onRecordStack } = setup({ kind: "tournament" });
		act(() => {
			result.current.form.setFieldValue("stackAmount", "9000");
			result.current.form.setFieldValue("totalEntries", "10");
		});
		await submit(result);
		expect(onRecordStack).toHaveBeenNthCalledWith(1, {
			stackAmount: 9000,
			totalEntries: 10,
		});
	});

	it("resets the stack field but keeps remainingPlayers and totalEntries after submit", async () => {
		const { result } = setup({ kind: "tournament" });
		act(() => {
			result.current.form.setFieldValue("stackAmount", "51800");
			result.current.form.setFieldValue("remainingPlayers", "42");
			result.current.form.setFieldValue("totalEntries", "128");
		});
		await submit(result);
		expect(result.current.form.state.values.stackAmount).toBe("");
		expect(result.current.form.state.values.remainingPlayers).toBe("42");
		expect(result.current.form.state.values.totalEntries).toBe("128");
	});
});

describe("useStackQuickInput — validation rejection", () => {
	it("rejects an empty stack amount", async () => {
		const { result, onRecordStack } = setup();
		await submit(result);
		expect(onRecordStack).not.toHaveBeenCalled();
	});

	it("rejects a non-numeric stack amount", async () => {
		const { result, onRecordStack } = setup();
		act(() => {
			result.current.form.setFieldValue("stackAmount", "abc");
		});
		await submit(result);
		expect(onRecordStack).not.toHaveBeenCalled();
	});

	it("rejects remainingPlayers greater than totalEntries", async () => {
		const { result, onRecordStack } = setup({ kind: "tournament" });
		act(() => {
			result.current.form.setFieldValue("stackAmount", "1000");
			result.current.form.setFieldValue("remainingPlayers", "10");
			result.current.form.setFieldValue("totalEntries", "5");
		});
		await submit(result);
		expect(onRecordStack).not.toHaveBeenCalled();
	});

	it("accepts remainingPlayers equal to totalEntries", async () => {
		const { result, onRecordStack } = setup({ kind: "tournament" });
		act(() => {
			result.current.form.setFieldValue("stackAmount", "1000");
			result.current.form.setFieldValue("remainingPlayers", "5");
			result.current.form.setFieldValue("totalEntries", "5");
		});
		await submit(result);
		expect(onRecordStack).toHaveBeenNthCalledWith(1, {
			stackAmount: 1000,
			remainingPlayers: 5,
			totalEntries: 5,
		});
	});
});

describe("useStackQuickInput — staleness", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns a null lastUpdateText and hides staleness when lastStackUpdatedAt is null", () => {
		const { result } = setup({ lastStackUpdatedAt: null });
		expect(result.current.lastUpdateText).toBeNull();
		expect(result.current.showStaleness).toBe(false);
	});

	it("formats lastUpdateText as zero-padded local HH:MM", () => {
		const { result } = setup({
			lastStackUpdatedAt: new Date(2026, 7, 26, 9, 5, 0),
		});
		expect(result.current.lastUpdateText).toBe("09:05");
		expect(result.current.showStaleness).toBe(true);
	});

	it("returns muted staleness for a recent update", () => {
		const { result } = setup({
			lastStackUpdatedAt: new Date(NOW.getTime() - 5 * 60_000),
		});
		expect(result.current.staleness).toEqual({
			agoText: "5m ago",
			tone: "muted",
		});
	});

	it("returns warning staleness at the 20-minute boundary", () => {
		const { result } = setup({
			lastStackUpdatedAt: new Date(NOW.getTime() - 20 * 60_000),
		});
		expect(result.current.staleness).toEqual({
			agoText: "20m ago",
			tone: "warning",
		});
	});

	it("returns destructive staleness at the 45-minute boundary", () => {
		const { result } = setup({
			lastStackUpdatedAt: new Date(NOW.getTime() - 45 * 60_000),
		});
		expect(result.current.staleness).toEqual({
			agoText: "45m ago",
			tone: "destructive",
		});
	});
});
