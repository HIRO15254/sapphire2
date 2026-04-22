import { useForm } from "@tanstack/react-form";
import { useState } from "react";

interface RingGame {
	currencyId: string | null;
	id: string;
	maxBuyIn: number | null;
	minBuyIn: number | null;
	name: string;
}

interface UseCreateCashGameSessionFormOptions {
	onStoreChange?: (storeId?: string) => void;
	onSubmit: (values: {
		currencyId?: string;
		initialBuyIn: number;
		memo?: string;
		ringGameId?: string;
		storeId?: string;
	}) => void;
	ringGames: RingGame[];
}

export function useCreateCashGameSessionForm({
	onStoreChange,
	onSubmit,
	ringGames,
}: UseCreateCashGameSessionFormOptions) {
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		undefined
	);
	const [selectedRingGameId, setSelectedRingGameId] = useState<
		string | undefined
	>(undefined);
	const [selectedCurrencyId, setSelectedCurrencyId] = useState<
		string | undefined
	>(undefined);

	const selectedRingGame = selectedRingGameId
		? ringGames.find((g) => g.id === selectedRingGameId)
		: null;

	const isCurrencyLocked =
		selectedRingGame?.currencyId !== null &&
		selectedRingGame?.currencyId !== undefined;

	const form = useForm({
		defaultValues: {
			initialBuyIn: "",
			memo: "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				storeId: selectedStoreId,
				ringGameId: selectedRingGameId,
				currencyId: selectedCurrencyId,
				initialBuyIn: Number(value.initialBuyIn),
				memo: value.memo || undefined,
			});
		},
	});

	const handleStoreChange = (value: string) => {
		setSelectedStoreId(value);
		setSelectedRingGameId(undefined);
		form.setFieldValue("initialBuyIn", "");
		onStoreChange?.(value);
	};

	const handleRingGameChange = (value: string) => {
		setSelectedRingGameId(value);
		const ringGame = ringGames.find((g) => g.id === value);
		if (ringGame) {
			form.setFieldValue("initialBuyIn", ringGame.maxBuyIn?.toString() ?? "");
			setSelectedCurrencyId(ringGame.currencyId ?? undefined);
		}
	};

	const handleCurrencyChange = (value: string) => {
		setSelectedCurrencyId(value);
	};

	return {
		form,
		selectedStoreId,
		selectedRingGameId,
		selectedRingGame,
		selectedCurrencyId,
		isCurrencyLocked,
		handleStoreChange,
		handleRingGameChange,
		handleCurrencyChange,
	};
}
