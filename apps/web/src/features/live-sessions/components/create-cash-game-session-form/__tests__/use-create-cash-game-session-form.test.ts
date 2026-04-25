import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCreateCashGameSessionForm } from "@/features/live-sessions/components/create-cash-game-session-form/use-create-cash-game-session-form";

const RING_GAMES = [
	{
		id: "rg1",
		name: "1/2 NLH",
		currencyId: "c1",
		minBuyIn: 40,
		maxBuyIn: 200,
	},
	{
		id: "rg2",
		name: "Freeplay",
		currencyId: null,
		minBuyIn: null,
		maxBuyIn: null,
	},
];

describe("useCreateCashGameSessionForm", () => {
	it("starts with all selections undefined and empty form values", () => {
		const { result } = renderHook(() =>
			useCreateCashGameSessionForm({
				onSubmit: vi.fn(),
				ringGames: RING_GAMES,
			})
		);
		expect(result.current.selectedStoreId).toBeUndefined();
		expect(result.current.selectedRingGameId).toBeUndefined();
		expect(result.current.selectedCurrencyId).toBeUndefined();
		expect(result.current.form.state.values).toEqual({
			initialBuyIn: "",
			memo: "",
		});
	});

	it("handleStoreChange sets the store, clears ringGameId, resets initialBuyIn and notifies onStoreChange", () => {
		const onStoreChange = vi.fn();
		const { result } = renderHook(() =>
			useCreateCashGameSessionForm({
				onSubmit: vi.fn(),
				onStoreChange,
				ringGames: RING_GAMES,
			})
		);
		act(() => {
			result.current.form.setFieldValue("initialBuyIn", "100");
			result.current.handleStoreChange("s1");
		});
		expect(result.current.selectedStoreId).toBe("s1");
		expect(result.current.selectedRingGameId).toBeUndefined();
		expect(result.current.form.state.values.initialBuyIn).toBe("");
		expect(onStoreChange).toHaveBeenCalledWith("s1");
	});

	it("handleRingGameChange(undefined) is a no-op for form values", () => {
		const { result } = renderHook(() =>
			useCreateCashGameSessionForm({
				onSubmit: vi.fn(),
				ringGames: RING_GAMES,
			})
		);
		act(() => {
			result.current.handleRingGameChange(undefined);
		});
		expect(result.current.selectedRingGameId).toBeUndefined();
		expect(result.current.form.state.values.initialBuyIn).toBe("");
	});

	it("handleRingGameChange seeds initialBuyIn from the ring game's maxBuyIn and locks currency", () => {
		const { result } = renderHook(() =>
			useCreateCashGameSessionForm({
				onSubmit: vi.fn(),
				ringGames: RING_GAMES,
			})
		);
		act(() => {
			result.current.handleRingGameChange("rg1");
		});
		expect(result.current.selectedRingGameId).toBe("rg1");
		expect(result.current.form.state.values.initialBuyIn).toBe("200");
		expect(result.current.selectedCurrencyId).toBe("c1");
		expect(result.current.isCurrencyLocked).toBe(true);
	});

	it("handleRingGameChange for a game with null currencyId does not lock currency", () => {
		const { result } = renderHook(() =>
			useCreateCashGameSessionForm({
				onSubmit: vi.fn(),
				ringGames: RING_GAMES,
			})
		);
		act(() => {
			result.current.handleRingGameChange("rg2");
		});
		expect(result.current.isCurrencyLocked).toBe(false);
		expect(result.current.selectedCurrencyId).toBeUndefined();
		expect(result.current.form.state.values.initialBuyIn).toBe("");
	});

	it("handleCurrencyChange updates selectedCurrencyId", () => {
		const { result } = renderHook(() =>
			useCreateCashGameSessionForm({
				onSubmit: vi.fn(),
				ringGames: RING_GAMES,
			})
		);
		act(() => {
			result.current.handleCurrencyChange("c99");
		});
		expect(result.current.selectedCurrencyId).toBe("c99");
	});

	it("submits with parsed initialBuyIn and normalised memo (omitted when blank)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCreateCashGameSessionForm({ onSubmit, ringGames: RING_GAMES })
		);
		act(() => {
			result.current.handleStoreChange("s1");
			result.current.handleRingGameChange("rg1");
			result.current.form.setFieldValue("initialBuyIn", "150");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			storeId: "s1",
			ringGameId: "rg1",
			currencyId: "c1",
			initialBuyIn: 150,
			memo: undefined,
		});
	});

	it("submits memo string only when non-empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useCreateCashGameSessionForm({ onSubmit, ringGames: RING_GAMES })
		);
		act(() => {
			result.current.form.setFieldValue("initialBuyIn", "100");
			result.current.form.setFieldValue("memo", "hello");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ memo: "hello" })
		);
	});
});
