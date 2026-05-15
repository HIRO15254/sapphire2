import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
	buildDefaults,
	numStrOrEmpty,
	parseOptInt,
	type RingGameOption,
	type SessionBlindLevelInput,
	type SessionChipPurchaseInput,
	type SessionFormDefaults,
	type SessionFormFieldValues,
	type SessionFormValues,
	sessionFormSchema,
	type TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

interface UseSessionFormStateArgs {
	defaultValues?: SessionFormDefaults;
	onStoreChange?: (storeId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	tournaments?: TournamentOption[];
}

function emptyToUndefined(value: string): string | undefined {
	return value === "" ? undefined : value;
}

export function useSessionFormState({
	defaultValues,
	onStoreChange,
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
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		defaultValues?.storeId
	);
	const [selectedGameId, setSelectedGameId] = useState<string | undefined>(
		defaultValues?.ringGameId ?? defaultValues?.tournamentId
	);
	const [selectedCurrencyId, setSelectedCurrencyId] = useState<
		string | undefined
	>(defaultValues?.currencyId);
	const [blindLevels, setBlindLevels] = useState<SessionBlindLevelInput[]>(
		defaultValues?.blindLevels ?? []
	);
	const [chipPurchases, setChipPurchases] = useState<
		SessionChipPurchaseInput[]
	>(defaultValues?.chipPurchases ?? []);

	const isCashGame = sessionType === "cash_game";
	const gameOptions = isCashGame ? ringGames : tournaments;
	const gameLabel = isCashGame ? "Cash Game" : "Tournament";

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
				storeId: selectedStoreId,
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
				rebuyCount: parseOptInt(value.rebuyCount),
				rebuyCost: parseOptInt(value.rebuyCost),
				addonCost: parseOptInt(value.addonCost),
				bountyPrizes: parseOptInt(value.bountyPrizes),
				startingStack: parseOptInt(value.startingStack),
				bountyAmount: parseOptInt(value.bountyAmount),
				tableSize: parseOptInt(value.tableSize),
				variant: value.variant || undefined,
				blindLevels: blindLevels.length > 0 ? blindLevels : undefined,
				chipPurchases: chipPurchases.length > 0 ? chipPurchases : undefined,
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
			levels.map((l) => ({
				isBreak: l.isBreak,
				blind1: l.blind1,
				blind2: l.blind2,
				blind3: l.blind3,
				ante: l.ante,
				minutes: l.minutes,
			}))
		);
		setChipPurchases(
			purchases.map((p) => ({
				name: p.name,
				cost: p.cost,
				chips: p.chips,
			}))
		);
	};

	const applyTournamentDefaults = (gameId: string) => {
		const game = tournaments?.find((t) => t.id === gameId);
		if (!game) {
			return;
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

	const handleStoreChange = (value: string | undefined) => {
		setSelectedStoreId(value);
		setSelectedGameId(undefined);
		onStoreChange?.(value);
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

	return {
		form,
		sessionType,
		setSessionType,
		selectedTagIds,
		setSelectedTagIds,
		selectedStoreId,
		selectedGameId,
		selectedCurrencyId,
		setSelectedCurrencyId,
		blindLevels,
		setBlindLevels,
		chipPurchases,
		setChipPurchases,
		handleStoreChange,
		handleGameChange,
		gameOptions,
		gameLabel,
		isCashGame,
	};
}
