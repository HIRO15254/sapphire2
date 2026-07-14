import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { useForm } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import {
	buildDefaults,
	cashSessionFormSchema,
	numStrOrEmpty,
	parseOptInt,
	type RingGameOption,
	type SessionFormDefaults,
	type SessionFormFieldValues,
	type SessionFormValues,
	type TournamentOption,
	tournamentSessionFormSchema,
} from "@/features/sessions/utils/session-form-helpers";
import type { ChipPurchaseRow } from "@/shared/components/chip-purchases-editor";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import { useMixMasterEditing } from "@/shared/hooks/use-mix-master-editing";
import {
	scopeOf as getVariantScope,
	useVariantScope,
} from "@/shared/hooks/use-variant-scope";
import {
	fromMixGames,
	hasMixCellErrors,
	type MixGameGroupRow,
	rowsFromVariantLabels,
	toMixGames,
} from "@/shared/lib/mix-games";
import { toBlindLevelRows, toSessionBlindLevels } from "./blind-level-rows";
import {
	toChipPurchaseRows,
	toSessionChipPurchases,
} from "./chip-purchase-rows";

interface UseSessionFormStateArgs {
	/**
	 * Room to pre-select as the default (e.g. the geolocation-nearest room).
	 * Applied only while the user hasn't picked a room — never overrides a
	 * manual choice. Resolves asynchronously, so it seeds via an effect rather
	 * than `defaultValues`.
	 */
	defaultRoomId?: string;
	defaultValues?: SessionFormDefaults;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	onSubmitInvalid?: (fieldNames: string[]) => void;
	ringGames?: RingGameOption[];
	tournaments?: TournamentOption[];
}

function emptyToUndefined(value: string): string | undefined {
	return value === "" ? undefined : value;
}

function timerStringToUnix(value: string): number | undefined {
	if (value === "") {
		return undefined;
	}
	const ms = new Date(value).getTime();
	return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

function withoutPerLevelGames(levels: BlindLevelRow[]): BlindLevelRow[] {
	return levels.map((level) => ({ ...level, games: null }));
}

export function useSessionFormState({
	defaultRoomId,
	defaultValues,
	onRoomChange,
	onSubmit,
	onSubmitInvalid,
	ringGames,
	tournaments,
}: UseSessionFormStateArgs) {
	const {
		groupFor,
		isLoading: isMasterLoading,
		isMixValue,
		labelsFor,
		mixCompositionLabels,
		mixes,
		variants,
	} = useGameGroups();
	const [sessionType, setSessionType] = useState<"cash_game" | "tournament">(
		defaultValues?.type ?? "cash_game"
	);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
		defaultValues?.tagIds ?? []
	);
	const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(
		defaultValues?.roomId
	);
	const [selectedGameId, setSelectedGameId] = useState<string | undefined>(
		defaultValues?.ringGameId ?? defaultValues?.tournamentId
	);
	const [selectedCurrencyId, setSelectedCurrencyId] = useState<
		string | undefined
	>(defaultValues?.currencyId);
	const [blindLevels, setBlindLevels] = useState<BlindLevelRow[]>(
		toBlindLevelRows(defaultValues?.blindLevels ?? [])
	);
	// Mix-game group rows (cash). Array/table state lives outside the flat
	// tanstack form, same as blindLevels/chipPurchases.
	const [mixGames, setMixGamesState] = useState<MixGameGroupRow[]>(() =>
		fromMixGames(defaultValues?.mixGames ?? null, groupFor)
	);
	// The initializer above seeds exactly once; when it ran before the master
	// lists loaded it resolved against the pending fallback (no real group
	// identity). Re-derive from the stored snapshot once loading settles —
	// but only while the user hasn't touched the mix editor, so the one-shot
	// upgrade can never clobber their edits (c05).
	const mixTouchedRef = useRef(false);
	const initialMixGamesRef = useRef(defaultValues?.mixGames ?? null);
	const awaitingMasterLoadRef = useRef(isMasterLoading);
	useEffect(() => {
		if (!awaitingMasterLoadRef.current || isMasterLoading) {
			return;
		}
		awaitingMasterLoadRef.current = false;
		if (!mixTouchedRef.current) {
			setMixGamesState(fromMixGames(initialMixGamesRef.current, groupFor));
		}
	}, [isMasterLoading, groupFor]);

	// Every interactive write to the rows goes through here: it marks the
	// editor as touched so the post-load reseed stands down.
	const setMixGames = (rows: MixGameGroupRow[]) => {
		mixTouchedRef.current = true;
		setMixGamesState(rows);
	};
	const initialChipPurchases = toChipPurchaseRows(
		defaultValues?.chipPurchases ?? []
	);
	const [chipPurchases, setChipPurchases] = useState<ChipPurchaseRow[]>(
		initialChipPurchases.rows
	);
	// Purchase counts (the session result), keyed by `ChipPurchaseRow.uid`.
	const [chipPurchaseCounts, setChipPurchaseCounts] = useState<
		Record<string, number>
	>(initialChipPurchases.counts);

	const isCashGame = sessionType === "cash_game";
	const gameOptions = isCashGame ? ringGames : tournaments;
	const gameLabel = isCashGame ? "Cash game" : "Tournament";

	// Extracted from onSubmit to keep its cognitive complexity in budget.
	const buildCashSubmitValues = (value: SessionFormFieldValues) => {
		// Gate on the editor state, never a live master lookup: a deleted or
		// renamed mix master must not wipe the frozen snapshot on an
		// unrelated edit (c02/c02b).
		const submitMixGames = mixGames.length > 0 ? toMixGames(mixGames) : null;
		const hasMixGames = submitMixGames !== null;
		// Belt-and-braces against a stale third blind the current variant's
		// group cannot hold (c03) — onVariantChange also clears the field.
		const hasThirdSlot = labelsFor(value.variant).blind3 !== null;
		return {
			type: "cash_game" as const,
			buyIn: Number(value.buyIn),
			cashOut: Number(value.cashOut),
			evCashOut: parseOptInt(value.evCashOut),
			variant: value.variant || DEFAULT_VARIANT_LABEL,
			mixGames: submitMixGames,
			// A mix submit carries its amounts inside mixGames; the flat fields
			// must go out empty, not with stale pre-switch values (c04).
			blind1: hasMixGames ? undefined : parseOptInt(value.blind1),
			blind2: hasMixGames ? undefined : parseOptInt(value.blind2),
			blind3:
				hasMixGames || !hasThirdSlot ? undefined : parseOptInt(value.blind3),
			ante:
				hasMixGames || value.anteType === "none"
					? undefined
					: parseOptInt(value.ante),
			anteType: hasMixGames ? undefined : value.anteType || undefined,
			tableSize: parseOptInt(value.tableSize),
			minBuyIn: parseOptInt(value.minBuyIn),
			maxBuyIn: parseOptInt(value.maxBuyIn),
			ringGameId: selectedGameId,
		};
	};

	const form = useForm({
		defaultValues: buildDefaults(defaultValues),
		onSubmitInvalid: ({ formApi }) => {
			const fieldNames = Object.entries(formApi.state.fieldMeta)
				.filter(([, meta]) => (meta?.errors.length ?? 0) > 0)
				.map(([fieldName]) => fieldName);
			onSubmitInvalid?.(fieldNames);
		},

		onSubmit: ({ value }) => {
			const common = {
				sessionDate: value.sessionDate,
				startTime: value.startTime || undefined,
				endTime: value.endTime || undefined,
				breakMinutes: parseOptInt(value.breakMinutes),
				tagIds: selectedTagIds,
				memo: value.memo || undefined,
				roomId: selectedRoomId,
				currencyId: selectedCurrencyId,
				ruleName: emptyToUndefined(value.ruleName),
			};

			if (isCashGame) {
				// The mix cells live outside the flat form schema; block the
				// submit here so invalid text is never coerced to null by the
				// serializer — the editor cells already display the error (c31).
				if (hasMixCellErrors(mixGames)) {
					return;
				}
				onSubmit({ ...common, ...buildCashSubmitValues(value) });
				return;
			}

			const beforeDeadline = value.beforeDeadline === true;
			onSubmit({
				...common,
				type: "tournament",
				tournamentBuyIn: Number(value.tournamentBuyIn),
				entryFee: parseOptInt(value.entryFee),
				beforeDeadline,
				placement: beforeDeadline ? undefined : parseOptInt(value.placement),
				totalEntries: beforeDeadline
					? undefined
					: parseOptInt(value.totalEntries),
				prizeMoney: parseOptInt(value.prizeMoney),
				bountyPrizes: parseOptInt(value.bountyPrizes),
				startingStack: parseOptInt(value.startingStack),
				bountyAmount: parseOptInt(value.bountyAmount),
				tableSize: parseOptInt(value.tableSize),
				variant: value.variant || undefined,
				timerStartedAt: timerStringToUnix(value.timerStartedAt),
				blindLevels:
					blindLevels.length > 0
						? toSessionBlindLevels(
								getVariantScope(value.variant) === "perLevel"
									? blindLevels
									: withoutPerLevelGames(blindLevels)
							)
						: undefined,
				chipPurchases:
					chipPurchases.length > 0
						? toSessionChipPurchases(chipPurchases, chipPurchaseCounts)
						: undefined,
				tournamentId: selectedGameId,
			});
		},
		validators: {
			onSubmit: isCashGame
				? cashSessionFormSchema
				: tournamentSessionFormSchema,
		},
	});

	const applyOverrides = (overrides: Partial<SessionFormFieldValues>) => {
		for (const [key, value] of Object.entries(overrides)) {
			if (value !== undefined) {
				form.setFieldValue(
					key as keyof SessionFormFieldValues,
					value as string
				);
			}
		}
	};

	const applyRingGameDefaults = (gameId: string) => {
		const game = ringGames?.find((g) => g.id === gameId);
		if (!game) {
			return;
		}
		if (game.currencyId) {
			setSelectedCurrencyId(game.currencyId);
		}
		setMixGames(fromMixGames(game.mixGames ?? null, groupFor));
		applyOverrides({
			ruleName: game.name,
			variant: game.variant ?? undefined,
			blind1: numStrOrEmpty(game.blind1 ?? undefined),
			blind2: numStrOrEmpty(game.blind2 ?? undefined),
			blind3: numStrOrEmpty(game.blind3 ?? undefined),
			ante: numStrOrEmpty(game.ante ?? undefined),
			anteType: game.anteType ?? undefined,
			tableSize: game.tableSize?.toString() ?? undefined,
			minBuyIn: numStrOrEmpty(game.minBuyIn ?? undefined),
			maxBuyIn: numStrOrEmpty(game.maxBuyIn ?? undefined),
		});
	};

	const applyTournamentStructure = async (tournamentId: string) => {
		// blindLevels / chipPurchases live in their own tables on the master.
		// Fetch them so the Rules step inline editors start with the parent's
		// shape. Errors are swallowed silently — the wizard still works with
		// the scalar defaults already applied.
		// Lazy-loaded so unit tests of pure-state behavior don't drag
		// @/utils/trpc (and its env-validating import chain) into module
		// initialization.
		const { trpcClient } = await import("@/utils/trpc");
		const [levels, purchases] = await Promise.all([
			trpcClient.blindLevel.listByTournament
				.query({ tournamentId })
				.catch(() => []),
			trpcClient.tournamentChipPurchase.listByTournament
				.query({ tournamentId })
				.catch(() => []),
		]);
		setBlindLevels(
			toBlindLevelRows(
				levels.map((l) => ({
					isBreak: l.isBreak,
					blind1: l.blind1,
					blind2: l.blind2,
					blind3: l.blind3,
					ante: l.ante,
					minutes: l.minutes,
					games: l.games ?? null,
				}))
			)
		);
		const chipRows = toChipPurchaseRows(
			purchases.map((p) => ({
				name: p.name,
				cost: p.cost,
				chips: p.chips,
			}))
		);
		setChipPurchases(chipRows.rows);
		setChipPurchaseCounts(chipRows.counts);
	};

	const applyTournamentDefaults = (gameId: string) => {
		const game = tournaments?.find((t) => t.id === gameId);
		if (!game) {
			return;
		}
		if (game.currencyId) {
			setSelectedCurrencyId(game.currencyId);
		}
		applyOverrides({
			ruleName: game.name,
			tournamentBuyIn: numStrOrEmpty(game.buyIn ?? undefined),
			entryFee: numStrOrEmpty(game.entryFee ?? undefined),
			startingStack: numStrOrEmpty(game.startingStack ?? undefined),
			bountyAmount: numStrOrEmpty(game.bountyAmount ?? undefined),
			tableSize: game.tableSize?.toString() ?? undefined,
			variant: game.variant ?? undefined,
		});
		// Fire-and-forget; React state updates land asynchronously.
		applyTournamentStructure(gameId).catch(() => undefined);
	};

	// Result step — set the purchase count for one chip purchase row.
	const updateChipPurchaseCount = (uid: string, count: number) => {
		setChipPurchaseCounts((prev) => ({ ...prev, [uid]: count }));
	};

	// Tracks whether the user has actively chosen a room. Once true, the
	// geolocation default must not override their choice.
	const userPickedRoomRef = useRef(false);

	const handleRoomChange = (value: string | undefined) => {
		userPickedRoomRef.current = true;
		setSelectedRoomId(value);
		setSelectedGameId(undefined);
		onRoomChange?.(value);
	};

	// Seed the geolocation-suggested room as the default. Fires only while the
	// user hasn't picked a room and none is selected yet, so a manual choice (or
	// an explicit clear) always wins, and a later suggestion never yanks the
	// current selection.
	useEffect(() => {
		if (!defaultRoomId || userPickedRoomRef.current || selectedRoomId) {
			return;
		}
		setSelectedRoomId(defaultRoomId);
		setSelectedGameId(undefined);
		onRoomChange?.(defaultRoomId);
	}, [defaultRoomId, selectedRoomId, onRoomChange]);

	const handleGameChange = (value: string | undefined) => {
		setSelectedGameId(value);
		if (!value) {
			return;
		}
		if (isCashGame) {
			applyRingGameDefaults(value);
		} else {
			applyTournamentDefaults(value);
		}
	};

	// The tournament scope and variant controls share this path: entering
	// per-level mode keeps its game assignments, while every all-levels value
	// clears them so hidden per-level games cannot leak into the snapshot.
	// Picking a mix master reseeds the cash mix editor from its saved
	// composition (overwriting whatever was there — switching mixes starts
	// fresh); the legacy "mix" mode key has no composition, so existing rows
	// are kept. Entering a mix clears the flat blind/ante fields so a later
	// switch-back starts clean (c04); leaving mixes clears the editor rows
	// so they stay the single submit-time authority (c02); and a variant
	// whose group has no third slot drops the stale blind3 (c03).
	const onVariantChange = (next: string) => {
		form.setFieldValue("variant", next);
		if (!isCashGame) {
			if (getVariantScope(next) === "all") {
				setBlindLevels(withoutPerLevelGames);
			}
			return;
		}
		if (isMixValue(next)) {
			if (next !== "mix") {
				setMixGames(
					rowsFromVariantLabels(mixCompositionLabels(next), groupFor)
				);
			}
			form.setFieldValue("blind1", "");
			form.setFieldValue("blind2", "");
			form.setFieldValue("blind3", "");
			form.setFieldValue("ante", "");
			form.setFieldValue("anteType", "none");
			return;
		}
		setMixGames([]);
		if (labelsFor(next).blind3 === null) {
			form.setFieldValue("blind3", "");
		}
	};

	const { onScopeChange, scopeOf } = useVariantScope({
		initialVariant: defaultValues?.variant,
		setVariant: onVariantChange,
	});

	const {
		editingMix,
		isMixSheetOpen,
		mixRowFor,
		onEditMix,
		onMixSaved,
		setIsMixSheetOpen,
	} = useMixMasterEditing({
		getRows: () => mixGames,
		groupFor,
		mixes,
		onVariantLabelChange: (label) => form.setFieldValue("variant", label),
		setRows: setMixGames,
		variants,
	});

	// The master option (ring game / tournament) the user picked on the
	// Master step, or undefined when defining the rule from scratch. The
	// Rules step compares against it to surface override badges.
	const selectedRingGame = isCashGame
		? ringGames?.find((g) => g.id === selectedGameId)
		: undefined;
	const selectedTournament = isCashGame
		? undefined
		: tournaments?.find((t) => t.id === selectedGameId);

	return {
		form,
		editingMix,
		groupFor,
		isMixSheetOpen,
		isMixValue,
		mixRowFor,
		onEditMix,
		onMixSaved,
		onScopeChange,
		onVariantChange,
		scopeOf,
		setIsMixSheetOpen,
		variants,
		sessionType,
		setSessionType,
		selectedTagIds,
		setSelectedTagIds,
		selectedRoomId,
		selectedGameId,
		selectedCurrencyId,
		setSelectedCurrencyId,
		selectedRingGame,
		selectedTournament,
		blindLevels,
		setBlindLevels,
		mixGames,
		setMixGames,
		chipPurchases,
		setChipPurchases,
		chipPurchaseCounts,
		setChipPurchaseCounts,
		updateChipPurchaseCount,
		handleRoomChange,
		handleGameChange,
		gameOptions,
		gameLabel,
		isCashGame,
	};
}
