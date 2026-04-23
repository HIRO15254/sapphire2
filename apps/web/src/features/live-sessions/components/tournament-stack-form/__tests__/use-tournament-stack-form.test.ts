import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useTournamentStackForm } from "@/features/live-sessions/components/tournament-stack-form/use-tournament-stack-form";
import { SessionFormProvider } from "@/features/live-sessions/hooks/use-session-form";

function wrapper({ children }: { children: ReactNode }) {
	return createElement(SessionFormProvider, null, children);
}

describe("useTournamentStackForm", () => {
	it("initialises both forms to empty values and recordTournamentInfo=true", () => {
		const { result } = renderHook(
			() => useTournamentStackForm({ onMemo: vi.fn(), onSubmit: vi.fn() }),
			{ wrapper }
		);
		expect(result.current.form.state.values).toEqual({
			stackAmount: "",
			remainingPlayers: "",
			totalEntries: "",
		});
		expect(result.current.memoForm.state.values.text).toBe("");
		expect(result.current.recordTournamentInfo).toBe(true);
		expect(result.current.chipPurchaseSheetOpen).toBe(false);
		expect(result.current.memoSheetOpen).toBe(false);
	});

	it("rejects submission when required stackAmount is empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() => useTournamentStackForm({ onMemo: vi.fn(), onSubmit }),
			{ wrapper }
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits with null remainingPlayers/totalEntries when blank", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() => useTournamentStackForm({ onMemo: vi.fn(), onSubmit }),
			{ wrapper }
		);
		act(() => {
			result.current.form.setFieldValue("stackAmount", "30000");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			stackAmount: 30_000,
			recordTournamentInfo: true,
			remainingPlayers: null,
			totalEntries: null,
			chipPurchaseCounts: [],
		});
	});

	it("submits numeric remainingPlayers/totalEntries when populated", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() => useTournamentStackForm({ onMemo: vi.fn(), onSubmit }),
			{ wrapper }
		);
		act(() => {
			result.current.form.setFieldValue("stackAmount", "25000");
			result.current.form.setFieldValue("remainingPlayers", "12");
			result.current.form.setFieldValue("totalEntries", "80");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				remainingPlayers: 12,
				totalEntries: 80,
			})
		);
	});

	it("syncs context stackAmount / remainingPlayers / totalEntries into the form", () => {
		const { result } = renderHook(
			() => useTournamentStackForm({ onMemo: vi.fn(), onSubmit: vi.fn() }),
			{ wrapper }
		);
		act(() => {
			result.current.setStackAmount("9999");
			result.current.setRemainingPlayers("7");
			result.current.setTotalEntries("60");
		});
		expect(result.current.form.state.values).toEqual({
			stackAmount: "9999",
			remainingPlayers: "7",
			totalEntries: "60",
		});
	});

	it("setChipPurchaseCounts replaces the context-managed count list", () => {
		const { result } = renderHook(
			() => useTournamentStackForm({ onMemo: vi.fn(), onSubmit: vi.fn() }),
			{ wrapper }
		);
		act(() => {
			result.current.setChipPurchaseCounts([
				{ name: "Rebuy", count: 2, chipsPerUnit: 5000 },
			]);
		});
		expect(result.current.chipPurchaseCounts).toEqual([
			{ name: "Rebuy", count: 2, chipsPerUnit: 5000 },
		]);
	});

	it("setRecordTournamentInfo flips the flag which is propagated on submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() => useTournamentStackForm({ onMemo: vi.fn(), onSubmit }),
			{ wrapper }
		);
		act(() => {
			result.current.setRecordTournamentInfo(false);
			result.current.form.setFieldValue("stackAmount", "10000");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ recordTournamentInfo: false })
		);
	});

	it("memoForm rejects blank text", async () => {
		const onMemo = vi.fn();
		const { result } = renderHook(
			() => useTournamentStackForm({ onMemo, onSubmit: vi.fn() }),
			{ wrapper }
		);
		await act(async () => {
			await result.current.memoForm.handleSubmit();
		});
		expect(onMemo).not.toHaveBeenCalled();
	});

	it("memoForm submits non-blank text, closing the sheet and resetting the text", async () => {
		const onMemo = vi.fn();
		const { result } = renderHook(
			() => useTournamentStackForm({ onMemo, onSubmit: vi.fn() }),
			{ wrapper }
		);
		act(() => {
			result.current.setMemoSheetOpen(true);
			result.current.memoForm.setFieldValue("text", "notes");
		});
		await act(async () => {
			await result.current.memoForm.handleSubmit();
		});
		expect(onMemo).toHaveBeenCalledWith("notes");
		expect(result.current.memoSheetOpen).toBe(false);
		expect(result.current.memoForm.state.values.text).toBe("");
	});
});
