import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCreateTournamentSessionForm } from "@/features/live-sessions/components/create-tournament-session-form/use-create-tournament-session-form";

const TOURNAMENTS = [
	{
		id: "t1",
		name: "Main",
		buyIn: 100,
		entryFee: 10,
		startingStack: 20_000,
		currencyId: "c1",
	},
	{
		id: "t2",
		name: "Freeroll",
		buyIn: null,
		entryFee: null,
		startingStack: null,
		currencyId: null,
	},
];

describe("useCreateTournamentSessionForm", () => {
	it("initialises with all selections undefined and empty form values", () => {
		const { result } = renderHook(() =>
			useCreateTournamentSessionForm({
				onSubmit: vi.fn(),
				tournaments: TOURNAMENTS,
			})
		);
		expect(result.current.selectedStoreId).toBeUndefined();
		expect(result.current.selectedTournamentId).toBeUndefined();
		expect(result.current.isBuyInLocked).toBe(false);
		expect(result.current.isEntryFeeLocked).toBe(false);
		expect(result.current.isStartingStackLocked).toBe(false);
		expect(result.current.isCurrencyLocked).toBe(false);
	});

	it("handleStoreChange sets the store, clears tournamentId, and notifies callback", () => {
		const onStoreChange = vi.fn();
		const { result } = renderHook(() =>
			useCreateTournamentSessionForm({
				onSubmit: vi.fn(),
				onStoreChange,
				tournaments: TOURNAMENTS,
			})
		);
		act(() => {
			result.current.handleStoreChange("s1");
		});
		expect(result.current.selectedStoreId).toBe("s1");
		expect(result.current.selectedTournamentId).toBeUndefined();
		expect(onStoreChange).toHaveBeenCalledWith("s1");
	});

	it("handleTournamentChange seeds buyIn/entryFee/startingStack from the tournament and locks all fields", () => {
		const { result } = renderHook(() =>
			useCreateTournamentSessionForm({
				onSubmit: vi.fn(),
				tournaments: TOURNAMENTS,
			})
		);
		act(() => {
			result.current.handleTournamentChange("t1");
		});
		expect(result.current.form.state.values.buyIn).toBe("100");
		expect(result.current.form.state.values.entryFee).toBe("10");
		expect(result.current.form.state.values.startingStack).toBe("20000");
		expect(result.current.selectedCurrencyId).toBe("c1");
		expect(result.current.isBuyInLocked).toBe(true);
		expect(result.current.isEntryFeeLocked).toBe(true);
		expect(result.current.isStartingStackLocked).toBe(true);
		expect(result.current.isCurrencyLocked).toBe(true);
	});

	it("handleTournamentChange for an all-null tournament does not lock any field", () => {
		const { result } = renderHook(() =>
			useCreateTournamentSessionForm({
				onSubmit: vi.fn(),
				tournaments: TOURNAMENTS,
			})
		);
		act(() => {
			result.current.handleTournamentChange("t2");
		});
		expect(result.current.isBuyInLocked).toBe(false);
		expect(result.current.isEntryFeeLocked).toBe(false);
		expect(result.current.isStartingStackLocked).toBe(false);
		expect(result.current.isCurrencyLocked).toBe(false);
	});

	it("handleTournamentChange(undefined) is a no-op on form values", () => {
		const { result } = renderHook(() =>
			useCreateTournamentSessionForm({
				onSubmit: vi.fn(),
				tournaments: TOURNAMENTS,
			})
		);
		act(() => {
			result.current.handleTournamentChange(undefined);
		});
		expect(result.current.selectedTournamentId).toBeUndefined();
	});

	it("rejects submission without buyIn / startingStack", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCreateTournamentSessionForm({ onSubmit, tournaments: TOURNAMENTS })
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits numeric payload with optional entryFee undefined when blank", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCreateTournamentSessionForm({ onSubmit, tournaments: TOURNAMENTS })
		);
		act(() => {
			result.current.handleStoreChange("s1");
			result.current.handleTournamentChange("t1");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				storeId: "s1",
				tournamentId: "t1",
				currencyId: "c1",
				buyIn: 100,
				entryFee: 10,
				startingStack: 20_000,
				memo: undefined,
				timerStartedAt: undefined,
			})
		);
	});

	it("submits timerStartedAt epoch seconds when field holds a valid datetime-local", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCreateTournamentSessionForm({ onSubmit, tournaments: TOURNAMENTS })
		);
		act(() => {
			result.current.handleTournamentChange("t1");
			result.current.form.setFieldValue("timerStartedAt", "2026-04-10T09:00");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		const [payload] = onSubmit.mock.calls[0];
		expect(typeof payload.timerStartedAt).toBe("number");
	});

	it("handleCurrencyChange updates selectedCurrencyId", () => {
		const { result } = renderHook(() =>
			useCreateTournamentSessionForm({
				onSubmit: vi.fn(),
				tournaments: TOURNAMENTS,
			})
		);
		act(() => {
			result.current.handleCurrencyChange("c42");
		});
		expect(result.current.selectedCurrencyId).toBe("c42");
	});
});
