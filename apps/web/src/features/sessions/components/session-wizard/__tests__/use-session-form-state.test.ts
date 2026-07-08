import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameVariant } from "@/features/game-variants/hooks/use-game-variants";

const gameVariantsMocks = vi.hoisted(() => ({
	variants: [] as GameVariant[],
}));

vi.mock("@/features/game-variants/hooks/use-game-variants", () => ({
	useGameVariants: () => ({ variants: gameVariantsMocks.variants }),
}));

import { useSessionFormState } from "@/features/sessions/components/session-wizard/use-session-form-state";
import type {
	RingGameOption,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

const NLH_VARIANT: GameVariant = {
	id: "v-nlh",
	name: "NLH",
	blindLabel1: "SB",
	blindLabel2: "BB",
	blindLabel3: "Straddle",
	sortOrder: 0,
	archivedAt: null,
};

const PLO_VARIANT: GameVariant = {
	id: "v-plo",
	name: "PLO",
	blindLabel1: "SB",
	blindLabel2: "BB",
	blindLabel3: "Straddle",
	sortOrder: 1,
	archivedAt: null,
};

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

describe("useSessionFormState", () => {
	beforeEach(() => {
		gameVariantsMocks.variants = [];
	});

	it("defaults sessionType to cash_game and gameOptions to ringGames", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionFormState({
				onSubmit,
				ringGames: RING_GAMES,
				tournaments: TOURNAMENTS,
			})
		);
		expect(result.current.sessionType).toBe("cash_game");
		expect(result.current.isCashGame).toBe(true);
		expect(result.current.gameLabel).toBe("Cash game");
		expect(result.current.gameOptions).toEqual(RING_GAMES);
	});

	it("switching sessionType updates isCashGame, gameLabel, and gameOptions", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionFormState({
				onSubmit,
				ringGames: RING_GAMES,
				tournaments: TOURNAMENTS,
			})
		);
		act(() => {
			result.current.setSessionType("tournament");
		});
		expect(result.current.isCashGame).toBe(false);
		expect(result.current.gameLabel).toBe("Tournament");
		expect(result.current.gameOptions).toEqual(TOURNAMENTS);
	});

	it("handleRoomChange updates selectedRoomId, clears selectedGameId, and notifies callback", () => {
		const onSubmit = vi.fn();
		const onRoomChange = vi.fn();
		const { result } = renderHook(() =>
			useSessionFormState({ onSubmit, onRoomChange })
		);
		act(() => {
			result.current.handleRoomChange("s1");
		});
		expect(result.current.selectedRoomId).toBe("s1");
		expect(result.current.selectedGameId).toBeUndefined();
		expect(onRoomChange).toHaveBeenCalledWith("s1");
	});

	it("handleGameChange(undefined) is a no-op on field overrides", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionFormState({ onSubmit, ringGames: RING_GAMES })
		);
		act(() => {
			result.current.handleGameChange(undefined);
		});
		expect(result.current.selectedGameId).toBeUndefined();
	});

	it("handleGameChange applies ring game defaults when cash game is active", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionFormState({ onSubmit, ringGames: RING_GAMES })
		);
		act(() => {
			result.current.handleGameChange("rg1");
		});
		expect(result.current.selectedGameId).toBe("rg1");
		expect(result.current.selectedCurrencyId).toBe("c1");
		expect(result.current.form.state.values.blind1).toBe("1");
		expect(result.current.form.state.values.blind2).toBe("2");
		expect(result.current.form.state.values.tableSize).toBe("9");
		expect(result.current.form.state.values.variant).toBe("nlh");
	});

	it("handleGameChange applies tournament defaults when tournament is active", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionFormState({ onSubmit, tournaments: TOURNAMENTS })
		);
		act(() => {
			result.current.setSessionType("tournament");
		});
		act(() => {
			result.current.handleGameChange("t1");
		});
		expect(result.current.selectedGameId).toBe("t1");
		expect(result.current.form.state.values.tournamentBuyIn).toBe("100");
		expect(result.current.form.state.values.entryFee).toBe("10");
	});

	it("submits a cash_game payload with the right shape", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionFormState({
				onSubmit,
				defaultValues: { type: "cash_game", sessionDate: "2026-04-10" },
				ringGames: RING_GAMES,
			})
		);
		act(() => {
			result.current.form.setFieldValue("buyIn", "100");
			result.current.form.setFieldValue("cashOut", "150");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "cash_game",
				buyIn: 100,
				cashOut: 150,
				sessionDate: "2026-04-10",
				variant: "NLH",
				anteType: "none",
				ante: undefined,
			})
		);
	});

	it("submits 'NLH' when the variant field is cleared to an empty string", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionFormState({
				onSubmit,
				defaultValues: { type: "cash_game", sessionDate: "2026-04-10" },
			})
		);
		act(() => {
			result.current.form.setFieldValue("buyIn", "100");
			result.current.form.setFieldValue("cashOut", "150");
			result.current.form.setFieldValue("variant", "");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ variant: "NLH" })
		);
	});

	it("submits the selected variant name as the tournament's frozen snapshot text", async () => {
		const onSubmit = vi.fn();
		gameVariantsMocks.variants = [PLO_VARIANT];
		const { result } = renderHook(() =>
			useSessionFormState({
				onSubmit,
				defaultValues: { type: "tournament", sessionDate: "2026-04-10" },
			})
		);
		act(() => {
			result.current.form.setFieldValue("tournamentBuyIn", "100");
			result.current.form.setFieldValue("variant", "PLO");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ type: "tournament", variant: "PLO" })
		);
	});

	it("submits a tournament payload and clears placement/totalEntries when beforeDeadline", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionFormState({
				onSubmit,
				defaultValues: {
					type: "tournament",
					sessionDate: "2026-04-10",
					beforeDeadline: true,
				},
			})
		);
		act(() => {
			result.current.form.setFieldValue("tournamentBuyIn", "100");
			result.current.form.setFieldValue("placement", "3");
			result.current.form.setFieldValue("totalEntries", "50");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "tournament",
				tournamentBuyIn: 100,
				beforeDeadline: true,
				placement: undefined,
				totalEntries: undefined,
			})
		);
	});

	it("submits tournament payload keeping placement when not beforeDeadline", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useSessionFormState({
				onSubmit,
				defaultValues: {
					type: "tournament",
					sessionDate: "2026-04-10",
					beforeDeadline: false,
				},
			})
		);
		act(() => {
			result.current.form.setFieldValue("tournamentBuyIn", "100");
			result.current.form.setFieldValue("placement", "3");
			result.current.form.setFieldValue("totalEntries", "50");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				placement: 3,
				totalEntries: 50,
			})
		);
	});

	it("seeds selectedGameId from defaultValues.ringGameId for cash and .tournamentId for tournament", () => {
		const onSubmit = vi.fn();
		const { result: cash } = renderHook(() =>
			useSessionFormState({
				onSubmit,
				defaultValues: { type: "cash_game", ringGameId: "rg1" },
			})
		);
		expect(cash.current.selectedGameId).toBe("rg1");
		const { result: tourney } = renderHook(() =>
			useSessionFormState({
				onSubmit,
				defaultValues: { type: "tournament", tournamentId: "t1" },
			})
		);
		expect(tourney.current.selectedGameId).toBe("t1");
	});

	describe("variants", () => {
		it("exposes the user's active game variants for the Rules-step selects", () => {
			gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useSessionFormState({ onSubmit }));
			expect(result.current.variants).toEqual([NLH_VARIANT, PLO_VARIANT]);
		});

		it("exposes an empty array when the user has no variants loaded yet", () => {
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useSessionFormState({ onSubmit }));
			expect(result.current.variants).toEqual([]);
		});
	});
});
