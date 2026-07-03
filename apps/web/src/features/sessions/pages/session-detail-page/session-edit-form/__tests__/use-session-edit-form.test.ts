import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSessionEditForm } from "@/features/sessions/pages/session-detail-page/session-edit-form/use-session-edit-form";
import type {
	RingGameOption,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

const RING_GAMES: RingGameOption[] = [
	{
		id: "rg1",
		name: "1/2 NLH",
		currencyId: "c1",
		variant: "nlh",
		blind1: 1,
		blind2: 2,
		blind3: null,
		ante: null,
		anteType: "none",
		tableSize: 9,
	},
];

const TOURNAMENTS: TournamentOption[] = [
	{ id: "t1", name: "Main Event", buyIn: 100, entryFee: 10 },
];

describe("useSessionEditForm", () => {
	it("seeds the form from a cash-game defaultValues and starts on cash type", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionEditForm({
				onSubmit,
				defaultValues: {
					type: "cash_game",
					sessionDate: "2026-04-10",
					buyIn: 10_000,
					cashOut: 11_500,
					ringGameId: "rg1",
					roomId: "r1",
					currencyId: "c1",
					tagIds: ["t1"],
					memo: "good run",
				},
				ringGames: RING_GAMES,
			})
		);
		expect(result.current.state.isCashGame).toBe(true);
		expect(result.current.state.form.state.values.buyIn).toBe("10000");
		expect(result.current.state.form.state.values.cashOut).toBe("11500");
		expect(result.current.state.form.state.values.memo).toBe("good run");
		expect(result.current.state.selectedGameId).toBe("rg1");
		expect(result.current.state.selectedRoomId).toBe("r1");
		expect(result.current.state.selectedCurrencyId).toBe("c1");
		expect(result.current.state.selectedTagIds).toEqual(["t1"]);
	});

	it("seeds the form from a tournament defaultValues and starts on tournament type", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionEditForm({
				onSubmit,
				defaultValues: {
					type: "tournament",
					sessionDate: "2026-04-10",
					tournamentId: "t1",
				},
				tournaments: TOURNAMENTS,
			})
		);
		expect(result.current.state.isCashGame).toBe(false);
		expect(result.current.state.selectedGameId).toBe("t1");
	});

	it("submits a cash_game payload carrying result, room, currency, tags and memo", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionEditForm({
				onSubmit,
				defaultValues: {
					type: "cash_game",
					sessionDate: "2026-04-10",
					buyIn: 10_000,
					cashOut: 11_500,
					roomId: "r1",
					currencyId: "c1",
					tagIds: ["t1"],
					memo: "good run",
				},
				ringGames: RING_GAMES,
			})
		);
		await act(async () => {
			await result.current.state.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "cash_game",
				buyIn: 10_000,
				cashOut: 11_500,
				sessionDate: "2026-04-10",
				roomId: "r1",
				currencyId: "c1",
				tagIds: ["t1"],
				memo: "good run",
			})
		);
	});

	it("submits a tournament payload carrying the tournament result fields", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionEditForm({
				onSubmit,
				defaultValues: {
					type: "tournament",
					sessionDate: "2026-04-10",
					tournamentBuyIn: 100,
					beforeDeadline: false,
					placement: 3,
					totalEntries: 50,
					tournamentId: "t1",
				},
				tournaments: TOURNAMENTS,
			})
		);
		await act(async () => {
			await result.current.state.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "tournament",
				tournamentBuyIn: 100,
				beforeDeadline: false,
				placement: 3,
				totalEntries: 50,
				tournamentId: "t1",
			})
		);
	});

	it("handleRoomChange clears the selected game and notifies the caller", () => {
		const onSubmit = vi.fn();
		const onRoomChange = vi.fn();
		const { result } = renderHook(() =>
			useSessionEditForm({
				onSubmit,
				onRoomChange,
				defaultValues: {
					type: "cash_game",
					ringGameId: "rg1",
					roomId: "r1",
				},
				ringGames: RING_GAMES,
			})
		);
		act(() => {
			result.current.state.handleRoomChange("r2");
		});
		expect(result.current.state.selectedRoomId).toBe("r2");
		expect(result.current.state.selectedGameId).toBeUndefined();
		expect(onRoomChange).toHaveBeenCalledTimes(1);
		expect(onRoomChange).toHaveBeenCalledWith("r2");
	});
});
