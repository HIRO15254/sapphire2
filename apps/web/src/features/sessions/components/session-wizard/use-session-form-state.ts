import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import type { ChipPurchaseRow } from "@/features/rooms/components/chip-purchases-editor";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import {
	buildDefaults,
	numStrOrEmpty,
	parseOptInt,
	type RingGameOption,
	type SessionFormDefaults,
	type SessionFormFieldValues,
	type SessionFormValues,
	sessionFormSchema,
	type TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
import { toBlindLevelRows, toSessionBlindLevels } from "./blind-level-rows";
import {
	toChipPurchaseRows,
	toSessionChipPurchases,
} from "./chip-purchase-rows";

interface UseSessionFormStateArgs {
	defaultValues?: SessionFormDefaults;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
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

export function useSessionFormState({
	defaultValues,
	onRoomChange,
	onSubmit,
	ringGames,
	tournaments,
}: UseSessionFormStateArgs) {
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

	const form = useForm({
		defaultValues: buildDefaults(defaultValues),
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
				onSubmit({
					...common,
					type: "cash_game",
					buyIn: Number(value.buyIn),
					cashOut: Number(value.cashOut),
					evCashOut: parseOptInt(value.evCashOut),
					variant: value.variant || "nlh",
					blind1: parseOptInt(value.blind1),
					blind2: parseOptInt(value.blind2),
					blind3: parseOptInt(value.blind3),
					ante: value.anteType === "none" ? undefined : parseOptInt(value.ante),
					anteType: value.anteType || undefined,
					tableSize: parseOptInt(value.tableSize),
					minBuyIn: parseOptInt(value.minBuyIn),
					maxBuyIn: parseOptInt(value.maxBuyIn),
					ringGameId: selectedGameId,
				});
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
						? toSessionBlindLevels(blindLevels)
						: undefined,
				chipPurchases:
					chipPurchases.length > 0
						? toSessionChipPurchases(chipPurchases, chipPurchaseCounts)
						: undefined,
				tournamentId: selectedGameId,
			});
		},
		validators: {
			onSubmit: sessionFormSchema,
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

	const handleRoomChange = (value: string | undefined) => {
		setSelectedRoomId(value);
		setSelectedGameId(undefined);
		onRoomChange?.(value);
	};

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
