import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useTournamentFormContext } from "@/live-sessions/hooks/use-session-form";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";

const updateSchema = z.object({
	stackAmount: requiredNumericString({ integer: true, min: 0 }),
	remainingPlayers: optionalNumericString({ integer: true, min: 1 }),
	totalEntries: optionalNumericString({ integer: true, min: 1 }),
});

const memoSchema = z.object({
	text: z.string().min(1, "Text is required"),
});

interface TournamentStackFormSubmitValues {
	chipPurchaseCounts: Array<{
		chipsPerUnit: number;
		count: number;
		name: string;
	}>;
	recordTournamentInfo: boolean;
	remainingPlayers: number | null;
	stackAmount: number;
	totalEntries: number | null;
}

interface UseTournamentStackFormOptions {
	onMemo: (text: string) => void;
	onSubmit: (values: TournamentStackFormSubmitValues) => void;
}

export function useTournamentStackForm({
	onMemo,
	onSubmit,
}: UseTournamentStackFormOptions) {
	const {
		state,
		setStackAmount,
		setRemainingPlayers,
		setTotalEntries,
		setChipPurchaseCounts,
	} = useTournamentFormContext();
	const { stackAmount, remainingPlayers, totalEntries, chipPurchaseCounts } =
		state;

	const [recordTournamentInfo, setRecordTournamentInfo] = useState(true);
	const [chipPurchaseSheetOpen, setChipPurchaseSheetOpen] = useState(false);
	const [memoSheetOpen, setMemoSheetOpen] = useState(false);

	const form = useForm({
		defaultValues: {
			stackAmount,
			remainingPlayers,
			totalEntries,
		},
		onSubmit: ({ value }) => {
			onSubmit({
				stackAmount: Number(value.stackAmount),
				recordTournamentInfo,
				remainingPlayers: value.remainingPlayers
					? Number(value.remainingPlayers)
					: null,
				totalEntries: value.totalEntries ? Number(value.totalEntries) : null,
				chipPurchaseCounts,
			});
		},
		validators: {
			onSubmit: updateSchema,
		},
	});

	useEffect(() => {
		if (form.state.values.stackAmount !== stackAmount) {
			form.setFieldValue("stackAmount", stackAmount);
		}
		if (form.state.values.remainingPlayers !== remainingPlayers) {
			form.setFieldValue("remainingPlayers", remainingPlayers);
		}
		if (form.state.values.totalEntries !== totalEntries) {
			form.setFieldValue("totalEntries", totalEntries);
		}
	}, [stackAmount, remainingPlayers, totalEntries, form]);

	const memoForm = useForm({
		defaultValues: { text: "" },
		onSubmit: ({ value }) => {
			onMemo(value.text);
			memoForm.reset();
			setMemoSheetOpen(false);
		},
		validators: {
			onSubmit: memoSchema,
		},
	});

	return {
		form,
		memoForm,
		stackAmount,
		setStackAmount,
		setRemainingPlayers,
		setTotalEntries,
		chipPurchaseCounts,
		setChipPurchaseCounts,
		recordTournamentInfo,
		setRecordTournamentInfo,
		chipPurchaseSheetOpen,
		setChipPurchaseSheetOpen,
		memoSheetOpen,
		setMemoSheetOpen,
	};
}
