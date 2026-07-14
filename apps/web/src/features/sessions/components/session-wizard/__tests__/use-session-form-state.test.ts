import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";
import type {
	RingGameOption,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
import { updateGroup } from "@/shared/lib/mix-games";

// useSessionFormState now calls useGameGroups (trpc.gameGroup.list /
// trpc.gameVariant.list) for the mix-games master mapping — mock the
// procedures to the fallback (empty) path by default; the post-load reseed
// tests swap in deferred promises to hold the master queries pending.
const masterQueries = vi.hoisted(() => ({
	groups: () => Promise.resolve([] as unknown[]),
	variants: () => Promise.resolve([] as unknown[]),
	mixes: () => Promise.resolve([] as unknown[]),
	reset() {
		masterQueries.groups = () => Promise.resolve([]);
		masterQueries.variants = () => Promise.resolve([]);
		masterQueries.mixes = () => Promise.resolve([]);
	},
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameGroup", "list"],
					queryFn: () => masterQueries.groups(),
				}),
			},
		},
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: () => masterQueries.variants(),
				}),
			},
		},
		gameMix: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameMix", "list"],
					queryFn: () => masterQueries.mixes(),
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
				variant: "NL Hold'em",
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

// Master fixture for mix-selection tests: two Big Bet variants plus a
// 2-slot Limit group variant, and two named mixes referencing the Big Bet
// pair in different combinations.
const GAME_GROUPS = [
	{
		id: "g-bigbet",
		builtinKey: "bigbet",
		label: "Big Bet",
		blind1Label: "SB",
		blind2Label: "BB",
		blind3Label: "Straddle",
	},
	{
		id: "g-limit",
		builtinKey: "limit",
		label: "Limit",
		blind1Label: "Small Bet",
		blind2Label: "Big Bet",
		blind3Label: null,
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
	{
		id: "v-lhe",
		builtinKey: "lhe",
		label: "Limit Hold'em",
		shortLabel: "LHE",
		groupId: "g-limit",
		sortOrder: 2,
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

const PER_LEVEL_GAMES = [
	{
		name: null,
		variants: ["NL Hold'em"],
		blind1: 100,
		blind2: 200,
		blind3: null,
		ante: 25,
	},
];

const TOURNAMENT_LEVELS_WITH_GAMES = [
	{
		isBreak: false,
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
		minutes: 20,
		games: PER_LEVEL_GAMES,
	},
];

function setupWithMasterData(
	defaultValues: Parameters<typeof useSessionFormState>[0]["defaultValues"] = {
		type: "cash_game",
	}
) {
	const qc = createTestQueryClient();
	qc.setQueryData(["gameGroup", "list"], GAME_GROUPS);
	qc.setQueryData(["gameVariant", "list"], GAME_VARIANTS);
	qc.setQueryData(["gameMix", "list"], GAME_MIXES);
	const onSubmit = vi.fn();
	const { result } = renderHook(
		() =>
			useSessionFormState({
				onSubmit,
				defaultValues,
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

describe("useSessionFormState — mix master edit sheet", () => {
	it("resolves the master row backing a mix label and rejects non-mix values", () => {
		const { result } = setupWithMasterData();
		expect(result.current.mixRowFor("8-Game")?.id).toBe("m-8game");
		expect(result.current.mixRowFor("horse")?.id).toBe("m-horse");
		expect(result.current.mixRowFor("mix")).toBeNull();
		expect(result.current.mixRowFor("NL Hold'em")).toBeNull();
	});

	it("opens the sheet with the master row for the current variant", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onEditMix("8-Game");
		});
		expect(result.current.isMixSheetOpen).toBe(true);
		expect(result.current.editingMix?.id).toBe("m-8game");
	});

	it("ignores edit requests for values without a mix master", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onEditMix("mix");
		});
		expect(result.current.isMixSheetOpen).toBe(false);
		expect(result.current.editingMix).toBeNull();
	});

	it("onMixSaved updates the variant, reseeds mixGames keeping amounts, and closes", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		act(() => {
			result.current.setMixGames(
				updateGroup(result.current.mixGames, result.current.mixGames[0].uid, {
					blind1: "100",
					blind2: "200",
				})
			);
			result.current.onEditMix("8-Game");
		});
		act(() => {
			result.current.onMixSaved({
				id: "m-8game",
				label: "8-Game Deluxe",
				games: ["v-plo"],
			});
		});
		expect(result.current.form.state.values.variant).toBe("8-Game Deluxe");
		expect(result.current.mixGames).toHaveLength(1);
		expect(result.current.mixGames[0].variants).toEqual(["PL Omaha"]);
		expect(result.current.mixGames[0].blind1).toBe("100");
		expect(result.current.isMixSheetOpen).toBe(false);
	});

	it("onMixSaved skips variant ids without a master row", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		act(() => {
			result.current.onMixSaved({
				id: "m-8game",
				label: "8-Game",
				games: ["v-deleted", "v-plo"],
			});
		});
		expect(result.current.mixGames[0].variants).toEqual(["PL Omaha"]);
	});

	it("exposes the variant master rows for the sheet's label mapping", () => {
		const { result } = setupWithMasterData();
		expect(result.current.variants.map((v) => v.id)).toEqual([
			"v-nlh",
			"v-plo",
			"v-lhe",
		]);
	});
});

// A session saved against a mix master keeps its frozen snapshot even after
// the master is deleted/renamed: the submit gates on the editor rows, never
// on a live master lookup (c02/c02b).
const FROZEN_MIX_GAMES = [
	{
		name: null,
		variants: ["NL Hold'em", "PL Omaha"],
		blind1: 10,
		blind2: 20,
		blind3: null,
		ante: null,
		anteType: "none" as const,
	},
];

async function submitCash(result: {
	current: ReturnType<typeof useSessionFormState>;
}) {
	act(() => {
		result.current.form.setFieldValue("buyIn", "100");
		result.current.form.setFieldValue("cashOut", "150");
	});
	await act(async () => {
		await result.current.form.handleSubmit();
	});
}

describe("useSessionFormState — frozen mixGames survive missing masters (c02)", () => {
	it("preserves the stored snapshot on an unrelated edit when the variant label has no live mix master", async () => {
		const { result, onSubmit } = setupWithMasterData({
			type: "cash_game",
			variant: "Dead Mix",
			mixGames: FROZEN_MIX_GAMES,
		});
		await submitCash(result);
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				variant: "Dead Mix",
				mixGames: FROZEN_MIX_GAMES,
			})
		);
	});

	it("clears the editor rows when switching to a plain variant", () => {
		const { result } = setupWithMasterData({
			type: "cash_game",
			variant: "Dead Mix",
			mixGames: FROZEN_MIX_GAMES,
		});
		expect(result.current.mixGames).toHaveLength(1);
		act(() => {
			result.current.onVariantChange("NL Hold'em");
		});
		expect(result.current.mixGames).toEqual([]);
	});
});

describe("useSessionFormState — stale flat fields on variant switches (c03/c04)", () => {
	it("clears blind3 when switching to a variant whose group has no third slot and submits it as undefined", async () => {
		const { result, onSubmit } = setupWithMasterData();
		act(() => {
			result.current.form.setFieldValue("blind3", "5");
			result.current.onVariantChange("Limit Hold'em");
		});
		expect(result.current.form.state.values.blind3).toBe("");
		await submitCash(result);
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ variant: "Limit Hold'em", blind3: undefined })
		);
	});

	it("submits blind3 as undefined for a 2-slot variant even when the field holds a stale value", async () => {
		const { result, onSubmit } = setupWithMasterData();
		act(() => {
			// Bypasses onVariantChange, so only the submit-time guard applies.
			result.current.form.setFieldValue("variant", "Limit Hold'em");
			result.current.form.setFieldValue("blind3", "5");
		});
		await submitCash(result);
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ blind3: undefined })
		);
	});

	it("clears flat blind/ante fields when switching into a mix and submits them as undefined", async () => {
		const { result, onSubmit } = setupWithMasterData();
		act(() => {
			result.current.form.setFieldValue("blind1", "1");
			result.current.form.setFieldValue("blind2", "2");
			result.current.form.setFieldValue("anteType", "bb");
			result.current.form.setFieldValue("ante", "3");
			result.current.onVariantChange("8-Game");
		});
		expect(result.current.form.state.values.blind1).toBe("");
		expect(result.current.form.state.values.blind2).toBe("");
		expect(result.current.form.state.values.blind3).toBe("");
		expect(result.current.form.state.values.ante).toBe("");
		expect(result.current.form.state.values.anteType).toBe("none");
		await submitCash(result);
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				blind1: undefined,
				blind2: undefined,
				blind3: undefined,
				ante: undefined,
				anteType: undefined,
				mixGames: [
					expect.objectContaining({ variants: ["NL Hold'em", "PL Omaha"] }),
				],
			})
		);
	});

	it("starts clean on the flat fields after switching back from a mix", async () => {
		const { result, onSubmit } = setupWithMasterData();
		act(() => {
			result.current.form.setFieldValue("blind1", "1");
			result.current.form.setFieldValue("blind2", "2");
			result.current.onVariantChange("8-Game");
		});
		act(() => {
			result.current.onVariantChange("NL Hold'em");
		});
		expect(result.current.form.state.values.blind1).toBe("");
		expect(result.current.form.state.values.blind2).toBe("");
		await submitCash(result);
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				blind1: undefined,
				blind2: undefined,
				mixGames: null,
			})
		);
	});
});

describe("useSessionFormState — mix cell validation (c31)", () => {
	it.each([
		"1.5",
		"-3",
		"abc",
	])("blocks submit when a mix blind cell holds %s", async (invalid) => {
		const { result, onSubmit } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		act(() => {
			result.current.setMixGames(
				updateGroup(result.current.mixGames, result.current.mixGames[0].uid, {
					blind1: invalid,
				})
			);
		});
		await submitCash(result);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("accepts empty and whole-number mix cells", async () => {
		const { result, onSubmit } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		act(() => {
			result.current.setMixGames(
				updateGroup(result.current.mixGames, result.current.mixGames[0].uid, {
					blind1: "200",
					blind2: "",
				})
			);
		});
		await submitCash(result);
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				mixGames: [expect.objectContaining({ blind1: 200, blind2: null })],
			})
		);
	});
});

describe("useSessionFormState — post-load mix rows reseed (c05)", () => {
	afterEach(() => {
		masterQueries.reset();
	});

	function deferred<T>() {
		let resolve!: (value: T) => void;
		const promise = new Promise<T>((res) => {
			resolve = res;
		});
		return { promise, resolve };
	}

	function setupWithPendingMasters() {
		const groups = deferred<unknown[]>();
		const variants = deferred<unknown[]>();
		const mixes = deferred<unknown[]>();
		masterQueries.groups = () => groups.promise;
		masterQueries.variants = () => variants.promise;
		masterQueries.mixes = () => mixes.promise;
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() =>
				useSessionFormState({
					onSubmit,
					defaultValues: {
						type: "cash_game",
						variant: "8-Game",
						mixGames: FROZEN_MIX_GAMES,
					},
				}),
			{ wrapper: withQueryClient(createTestQueryClient()) }
		);
		const resolveAll = async () => {
			await act(async () => {
				groups.resolve(GAME_GROUPS);
				variants.resolve(GAME_VARIANTS);
				mixes.resolve(GAME_MIXES);
				await Promise.all([groups.promise, variants.promise, mixes.promise]);
			});
		};
		return { result, resolveAll };
	}

	it("re-derives the seeded rows from the loaded masters once loading settles", async () => {
		const { result, resolveAll } = setupWithPendingMasters();
		// Seeded against the pending fallback: no real group identity yet.
		expect(result.current.mixGames[0].groupId).toContain("__pending__");
		await resolveAll();
		await waitFor(() => {
			expect(result.current.mixGames[0].groupId).toBe("g-bigbet");
		});
		expect(result.current.mixGames[0].groupLabel).toBe("Big Bet");
		expect(result.current.mixGames[0].blind1).toBe("10");
		expect(result.current.mixGames[0].blind2).toBe("20");
	});

	it("keeps user edits instead of reseeding when the editor was touched before load", async () => {
		const { result, resolveAll } = setupWithPendingMasters();
		act(() => {
			result.current.setMixGames(
				updateGroup(result.current.mixGames, result.current.mixGames[0].uid, {
					blind1: "999",
				})
			);
		});
		await resolveAll();
		await waitFor(() => {
			expect(result.current.variants).toHaveLength(3);
		});
		expect(result.current.mixGames[0].blind1).toBe("999");
		expect(result.current.mixGames[0].groupId).toContain("__pending__");
	});
});

describe("useSessionFormState — tournament variant scope", () => {
	it("derives 'perLevel' only from the per-level sentinel value", () => {
		const { result } = setupWithMasterData();
		expect(result.current.scopeOf("mix")).toBe("perLevel");
		expect(result.current.scopeOf("8-Game")).toBe("all");
		expect(result.current.scopeOf("NL Hold'em")).toBe("all");
	});

	it("switching to per-level freezes the sentinel", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onScopeChange("perLevel", "NL Hold'em");
		});
		expect(result.current.form.state.values.variant).toBe("mix");
	});

	it("switching back restores the variant remembered from the last switch", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onScopeChange("perLevel", "8-Game");
		});
		act(() => {
			result.current.onScopeChange("all", "mix");
		});
		expect(result.current.form.state.values.variant).toBe("8-Game");
	});

	it("switching back falls back to the default label without a remembered variant", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onScopeChange("all", "mix");
		});
		expect(result.current.form.state.values.variant).toBe("NL Hold'em");
	});

	it("clears every level's games when a per-level tournament selects a plain variant", () => {
		const { result } = setupWithMasterData({
			type: "tournament",
			variant: "mix",
			blindLevels: TOURNAMENT_LEVELS_WITH_GAMES,
		});

		act(() => {
			result.current.onVariantChange("NL Hold'em");
		});

		expect(result.current.blindLevels).toHaveLength(1);
		expect(result.current.blindLevels[0].games).toBeNull();
	});

	it("preserves per-level games when entering per-level mode, then clears them when returning to same-for-all", () => {
		const { result } = setupWithMasterData({
			type: "tournament",
			variant: "8-Game",
			blindLevels: TOURNAMENT_LEVELS_WITH_GAMES,
		});

		act(() => {
			result.current.onScopeChange("perLevel", "8-Game");
		});
		expect(result.current.form.state.values.variant).toBe("mix");
		expect(result.current.blindLevels[0].games).toEqual(PER_LEVEL_GAMES);

		act(() => {
			result.current.onScopeChange("all", "mix");
		});
		expect(result.current.form.state.values.variant).toBe("8-Game");
		expect(result.current.blindLevels[0].games).toBeNull();
	});

	it("normalizes stale level games out of a same-for-all tournament submit", async () => {
		const { result, onSubmit } = setupWithMasterData({
			type: "tournament",
			variant: "NL Hold'em",
			tournamentBuyIn: 100,
			blindLevels: TOURNAMENT_LEVELS_WITH_GAMES,
		});

		await act(async () => {
			await result.current.form.handleSubmit();
		});

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				variant: "NL Hold'em",
				blindLevels: [expect.objectContaining({ games: null })],
			})
		);
	});
});
