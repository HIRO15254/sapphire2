import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import z from "zod";
import { useStackFormContext } from "@/features/live-sessions/hooks/use-session-form";
import { requiredNumericString } from "@/shared/lib/form-fields";

const stackSchema = z.object({
	stackAmount: requiredNumericString({ integer: true, min: 0 }),
});

const memoSchema = z.object({
	text: z.string().min(1, "Text is required"),
});

interface UseCashGameStackFormOptions {
	onMemo: (text: string) => void;
	onSubmit: (values: { stackAmount: number }) => void;
}

export function useCashGameStackForm({
	onMemo,
	onSubmit,
}: UseCashGameStackFormOptions) {
	const { state, setStackAmount } = useStackFormContext();
	const { stackAmount } = state;

	const stackForm = useForm({
		defaultValues: { stackAmount },
		onSubmit: ({ value }) => {
			onSubmit({ stackAmount: Number(value.stackAmount) });
		},
		validators: {
			onSubmit: stackSchema,
		},
	});

	useEffect(() => {
		if (stackForm.state.values.stackAmount !== stackAmount) {
			stackForm.setFieldValue("stackAmount", stackAmount);
		}
	}, [stackAmount, stackForm]);

	const [allInBottomSheetOpen, setAllInBottomSheetOpen] = useState(false);
	const [addonBottomSheetOpen, setAddonBottomSheetOpen] = useState(false);
	const [removeBottomSheetOpen, setRemoveBottomSheetOpen] = useState(false);
	const [memoBottomSheetOpen, setMemoBottomSheetOpen] = useState(false);

	const memoForm = useForm({
		defaultValues: { text: "" },
		onSubmit: ({ value }) => {
			onMemo(value.text);
			memoForm.reset();
			setMemoBottomSheetOpen(false);
		},
		validators: {
			onSubmit: memoSchema,
		},
	});

	return {
		stackForm,
		memoForm,
		stackAmount,
		setStackAmount,
		allInBottomSheetOpen,
		setAllInBottomSheetOpen,
		addonBottomSheetOpen,
		setAddonBottomSheetOpen,
		removeBottomSheetOpen,
		setRemoveBottomSheetOpen,
		memoBottomSheetOpen,
		setMemoBottomSheetOpen,
	};
}
