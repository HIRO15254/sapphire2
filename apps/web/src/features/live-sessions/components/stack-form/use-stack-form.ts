import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import z from "zod";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";

const stackSchema = z.object({
	stackAmount: requiredNumericString({ integer: true, min: 0 }),
	remainingPlayers: optionalNumericString({ integer: true, min: 1 }),
	totalEntries: optionalNumericString({ integer: true, min: 1 }),
});

const memoSchema = z.object({
	text: z.string().min(1, "Text is required"),
});

export interface StackFormSubmitValues {
	chipPurchaseCounts?: Array<{
		chipPurchaseOptionId: string;
		count: number;
	}>;
	recordTournamentInfo?: boolean;
	remainingPlayers?: number | null;
	stackAmount: number;
	totalEntries?: number | null;
}

export interface ChipPurchaseType {
	chips: number;
	cost: number;
	id: number;
	name: string;
}

interface UseStackFormCashOptions {
	initialStackAmount?: string;
	kind: "cash_game";
	onMemo: (text: string) => void;
	onSubmit: (values: StackFormSubmitValues) => void;
}

interface UseStackFormTournamentOptions {
	chipPurchaseTypes?: ChipPurchaseType[];
	initialStackAmount?: string;
	kind: "tournament";
	onMemo: (text: string) => void;
	onPurchaseChips: (values: { chipPurchaseOptionId: string }) => void;
	onSubmit: (values: StackFormSubmitValues) => void;
}

type UseStackFormOptions =
	| UseStackFormCashOptions
	| UseStackFormTournamentOptions;

export function useStackForm(options: UseStackFormOptions) {
	const { kind, onMemo, onSubmit } = options;
	const initialStack = options.initialStackAmount ?? "";
	const chipPurchaseTypes =
		kind === "tournament"
			? ((options as UseStackFormTournamentOptions).chipPurchaseTypes ?? [])
			: [];

	const [chipPurchaseCounts, setChipPurchaseCounts] = useState<
		Array<{ chipPurchaseOptionId: string; count: number }>
	>([]);
	const [recordTournamentInfo, setRecordTournamentInfo] = useState(true);
	const [chipPurchaseSheetOpen, setChipPurchaseSheetOpen] = useState(false);
	const [allInBottomSheetOpen, setAllInBottomSheetOpen] = useState(false);
	const [addonBottomSheetOpen, setAddonBottomSheetOpen] = useState(false);
	const [removeBottomSheetOpen, setRemoveBottomSheetOpen] = useState(false);
	const [memoSheetOpen, setMemoSheetOpen] = useState(false);
	const [stackAmount, setStackAmountState] = useState(initialStack);

	const form = useForm({
		defaultValues: {
			stackAmount: initialStack,
			remainingPlayers: "",
			totalEntries: "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				stackAmount: Number(value.stackAmount),
				...(kind === "tournament"
					? {
							recordTournamentInfo,
							remainingPlayers: value.remainingPlayers
								? Number(value.remainingPlayers)
								: null,
							totalEntries: value.totalEntries
								? Number(value.totalEntries)
								: null,
							chipPurchaseCounts,
						}
					: {}),
			});
		},
		validators: { onSubmit: stackSchema },
	});

	const setStackAmount = (value: string) => {
		setStackAmountState(value);
		form.setFieldValue("stackAmount", value);
	};

	const memoForm = useForm({
		defaultValues: { text: "" },
		onSubmit: ({ value }) => {
			onMemo(value.text);
			memoForm.reset();
			setMemoSheetOpen(false);
		},
		validators: { onSubmit: memoSchema },
	});

	const handleChipPurchase = (values: { chipPurchaseOptionId: string }) => {
		if (kind === "tournament") {
			(options as UseStackFormTournamentOptions).onPurchaseChips(values);
		}
		setChipPurchaseSheetOpen(false);
	};

	return {
		form,
		memoForm,
		kind,
		stackAmount,
		setStackAmount,
		chipPurchaseCounts,
		setChipPurchaseCounts,
		chipPurchaseTypes,
		recordTournamentInfo,
		setRecordTournamentInfo,
		chipPurchaseSheetOpen,
		setChipPurchaseSheetOpen,
		allInBottomSheetOpen,
		setAllInBottomSheetOpen,
		addonBottomSheetOpen,
		setAddonBottomSheetOpen,
		removeBottomSheetOpen,
		setRemoveBottomSheetOpen,
		memoSheetOpen,
		setMemoSheetOpen,
		handleChipPurchase,
	};
}
