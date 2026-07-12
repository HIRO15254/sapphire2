import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";
import type {
	RingGameOption,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

// useSessionFormState now calls useGameGroups (trpc.gameGroup.list /
// trpc.gameVariant.list) for the mix-games master mapping — mock the
// procedures to the fallback (empty) path, none of the assertions below
// exercise mix-game rows.
vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameGroup", "list"],
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		gameMix: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameMix", "list"],
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
}));

import { useSessionFormState } from "@/features/sessions/components/session-wizard/use-session-form-state";

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
	it("defaults sessionType to cash_game and gameOptions to ringGames", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() =>
				useSessionFormState({
					onSubmit,
					ringGames: RING_GAMES,
					tournaments: TOURNAMENTS,
				}),
			{ wrapper: withQueryClient() }
		);
		expect(result.current.sessionType).toBe("cash_game");
		expect(result.current.isCashGame).toBe(true);
		expect(result.current.gameLabel).toBe("Cash game");
		expect(result.current.gameOptions).toEqual(RING_GAMES);
	});

	it("switching sessionType updates isCashGame, gameLabel, and gameOptions", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() =>
				useSessionFormState({
					onSubmit,
					ringGames: RING_GAMES,
					tournaments: TOURNAMENTS,
				}),
			{ wrapper: withQueryClient() }
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
		const { result } = renderHook(
			() => useSessionFormState({ onSubmit, onRoomChange }),
			{ wrapper: withQueryClient() }
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
		const { result } = renderHook(
			() => useSessionFormState({ onSubmit, ringGames: RING_GAMES }),
			{ wrapper: withQueryClient() }
		);
		act(() => {
			result.current.handleGameChange(undefined);
		});
		expect(result.current.selectedGameId).toBeUndefined();
	});

	it("handleGameChange applies ring game defaults when cash game is active", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() => useSessionFormState({ onSubmit, ringGames: RING_GAMES }),
			{ wrapper: withQueryClient() }
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
		const { result } = renderHook(
			() => useSessionFormState({ onSubmit, tournaments: TOURNAMENTS }),
			{ wrapper: withQueryClient() }
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
		const { result } = renderHook(
			() =>
				useSessionFormState({
					onSubmit,
					defaultValues: { type: "cash_game", sessionDate: "2026-04-10" },
					ringGames: RING_GAMES,
				}),
			{ wrapper: withQueryClient() }
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
				variant: "nlh",
				anteType: "none",
				ante: undefined,
			})
		);
	});

	it("submits a tournament payload and clears placement/totalEntries when beforeDeadline", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() =>
				useSessionFormState({
					onSubmit,
					defaultValues: {
						type: "tournament",
						sessionDate: "2026-04-10",
						beforeDeadline: true,
					},
				}),
			{ wrapper: withQueryClient() }
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
		const { result } = renderHook(
			() =>
				useSessionFormState({
					onSubmit,
					defaultValues: {
						type: "tournament",
						sessionDate: "2026-04-10",
						beforeDeadline: false,
					},
				}),
			{ wrapper: withQueryClient() }
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
		const { result: cash } = renderHook(
			() =>
				useSessionFormState({
					onSubmit,
					defaultValues: { type: "cash_game", ringGameId: "rg1" },
				}),
			{ wrapper: withQueryClient() }
		);
		expect(cash.current.selectedGameId).toBe("rg1");
		const { result: tourney } = renderHook(
			() =>
				useSessionFormState({
					onSubmit,
					defaultValues: { type: "tournament", tournamentId: "t1" },
				}),
			{ wrapper: withQueryClient() }
		);
		expect(tourney.current.selectedGameId).toBe("t1");
	});
});

// Master fixture for mix-selection tests: two Big Bet variants, plus two
// named mixes referencing them in different combinations.
const GAME_GROUPS = [
	{
		id: "g-bigbet",
		builtinKey: "bigbet",
		label: "Big Bet",
		blind1Label: "SB",
		blind2Label: "BB",
		blind3Label: "Straddle",
	},
];
const GAME_VARIANTS = [
	{
		id: "v-nlh",
		builtinKey: "nlh",
		label: "NL Hold'em",
		shortLabel: "NLH",
		groupId: "g-bigbet",
		sortOrder: 0,
	},
	{
		id: "v-plo",
		builtinKey: "plo",
		label: "PL Omaha",
		shortLabel: "PLO",
		groupId: "g-bigbet",
		sortOrder: 1,
	},
];
const GAME_MIXES = [
	{
		id: "m-8game",
		builtinKey: "8-game",
		label: "8-Game",
		games: ["v-nlh", "v-plo"],
	},
	{ id: "m-horse", builtinKey: "horse", label: "HORSE", games: ["v-nlh"] },
];

function setupWithMasterData() {
	const qc = createTestQueryClient();
	qc.setQueryData(["gameGroup", "list"], GAME_GROUPS);
	qc.setQueryData(["gameVariant", "list"], GAME_VARIANTS);
	qc.setQueryData(["gameMix", "list"], GAME_MIXES);
	const onSubmit = vi.fn();
	const { result } = renderHook(
		() =>
			useSessionFormState({
				onSubmit,
				defaultValues: { type: "cash_game" },
			}),
		{ wrapper: withQueryClient(qc) }
	);
	return { result, onSubmit };
}

describe("useSessionFormState — onVariantChange mix expansion", () => {
	it("sets the variant field and seeds mixGames from the mix's composition", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		expect(result.current.form.state.values.variant).toBe("8-Game");
		expect(result.current.mixGames).toHaveLength(1);
		expect(result.current.mixGames[0].variants).toEqual([
			"NL Hold'em",
			"PL Omaha",
		]);
	});

	it("reseeds (overwrites) mixGames when switching to a different mix", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		expect(result.current.mixGames[0].variants).toEqual([
			"NL Hold'em",
			"PL Omaha",
		]);
		act(() => {
			result.current.onVariantChange("HORSE");
		});
		expect(result.current.mixGames).toHaveLength(1);
		expect(result.current.mixGames[0].variants).toEqual(["NL Hold'em"]);
	});

	it("does not clear existing mixGames rows when selecting the legacy 'mix' value", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		const seeded = result.current.mixGames;
		act(() => {
			result.current.onVariantChange("mix");
		});
		expect(result.current.form.state.values.variant).toBe("mix");
		expect(result.current.mixGames).toBe(seeded);
	});

	it("submits mixGames as null when the variant is a plain (non-mix) value", async () => {
		const { result, onSubmit } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
			result.current.onVariantChange("NL Hold'em");
			result.current.form.setFieldValue("buyIn", "100");
			result.current.form.setFieldValue("cashOut", "150");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ variant: "NL Hold'em", mixGames: null })
		);
	});

	it("submits mixGames from the seeded composition when the variant is a mix label", async () => {
		const { result, onSubmit } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
			result.current.form.setFieldValue("buyIn", "100");
			result.current.form.setFieldValue("cashOut", "150");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				variant: "8-Game",
				mixGames: [
					expect.objectContaining({ variants: ["NL Hold'em", "PL Omaha"] }),
				],
			})
		);
	});
});
