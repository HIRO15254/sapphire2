import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import z from "zod";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";

const createTournamentSessionFormSchema = z.object({
	buyIn: requiredNumericString({ integer: true, min: 0 }),
	entryFee: optionalNumericString({ integer: true, min: 0 }),
	startingStack: requiredNumericString({ integer: true, min: 0 }),
	memo: z.string(),
	timerStartedAt: z.string(),
});

function parseTimerStartedAt(value: string): number | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return;
	}
	const parsed = new Date(trimmed);
	const ms = parsed.getTime();
	if (Number.isNaN(ms)) {
		return;
	}
	return Math.floor(ms / 1000);
}

interface Tournament {
	buyIn: number | null;
	currencyId: string | null;
	entryFee: number | null;
	id: string;
	name: string;
	startingStack: number | null;
}

interface UseCreateTournamentSessionFormOptions {
	onStoreChange?: (storeId?: string) => void;
	onSubmit: (values: {
		buyIn: number;
		currencyId?: string;
		entryFee?: number;
		memo?: string;
		startingStack: number;
		storeId?: string;
		timerStartedAt?: number;
		tournamentId?: string;
	}) => void;
	tournaments: Tournament[];
}

export function useCreateTournamentSessionForm({
	onStoreChange,
	onSubmit,
	tournaments,
}: UseCreateTournamentSessionFormOptions) {
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		undefined
	);
	const [selectedTournamentId, setSelectedTournamentId] = useState<
		string | undefined
	>(undefined);
	const [selectedCurrencyId, setSelectedCurrencyId] = useState<
		string | undefined
	>(undefined);

	const form = useForm({
		defaultValues: {
			buyIn: "",
			entryFee: "",
			startingStack: "",
			memo: "",
			timerStartedAt: "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				storeId: selectedStoreId,
				tournamentId: selectedTournamentId,
				currencyId: selectedCurrencyId,
				buyIn: Number(value.buyIn),
				entryFee: value.entryFee ? Number(value.entryFee) : undefined,
				startingStack: Number(value.startingStack),
				memo: value.memo ? value.memo : undefined,
				timerStartedAt: parseTimerStartedAt(value.timerStartedAt),
			});
		},
		validators: {
			onSubmit: createTournamentSessionFormSchema,
		},
	});

	const handleStoreChange = (value: string | undefined) => {
		setSelectedStoreId(value);
		setSelectedTournamentId(undefined);
		onStoreChange?.(value);
	};

	const applyTournamentDefaults = (t: Tournament) => {
		if (t.currencyId) {
			setSelectedCurrencyId(t.currencyId);
		}
		if (t.buyIn !== null) {
			form.setFieldValue("buyIn", String(t.buyIn));
		}
		if (t.entryFee !== null) {
			form.setFieldValue("entryFee", String(t.entryFee));
		}
		if (t.startingStack !== null) {
			form.setFieldValue("startingStack", String(t.startingStack));
		}
	};

	const handleTournamentChange = (value: string | undefined) => {
		setSelectedTournamentId(value);
		if (value === undefined) {
			return;
		}
		const t = tournaments.find((tour) => tour.id === value);
		if (t) {
			applyTournamentDefaults(t);
		}
	};

	const handleCurrencyChange = (value: string | undefined) => {
		setSelectedCurrencyId(value);
	};

	const selectedTournament = selectedTournamentId
		? tournaments.find((t) => t.id === selectedTournamentId)
		: null;

	const isBuyInLocked =
		selectedTournament?.buyIn !== null &&
		selectedTournament?.buyIn !== undefined;
	const isEntryFeeLocked =
		selectedTournament?.entryFee !== null &&
		selectedTournament?.entryFee !== undefined;
	const isStartingStackLocked =
		selectedTournament?.startingStack !== null &&
		selectedTournament?.startingStack !== undefined;
	const isCurrencyLocked =
		selectedTournament?.currencyId !== null &&
		selectedTournament?.currencyId !== undefined;

	return {
		form,
		selectedStoreId,
		selectedTournamentId,
		selectedCurrencyId,
		isBuyInLocked,
		isEntryFeeLocked,
		isStartingStackLocked,
		isCurrencyLocked,
		handleStoreChange,
		handleTournamentChange,
		handleCurrencyChange,
	};
}
