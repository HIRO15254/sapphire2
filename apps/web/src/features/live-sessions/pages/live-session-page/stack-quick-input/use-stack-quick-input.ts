import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import z from "zod";
import { requiredNumericString } from "@/shared/lib/form-fields";

const stackQuickInputSchema = z.object({
	stackAmount: requiredNumericString({ integer: true, min: 0 }),
});

interface UseStackQuickInputOptions {
	currentStack: number | null;
	isSaving: boolean;
	onSubmit: (values: { stackAmount: number }) => void;
}

function toFieldValue(currentStack: number | null): string {
	return currentStack === null ? "" : String(currentStack);
}

export function useStackQuickInput({
	currentStack,
	isSaving,
	onSubmit,
}: UseStackQuickInputOptions) {
	const form = useForm({
		defaultValues: { stackAmount: toFieldValue(currentStack) },
		onSubmit: ({ value }) => {
			onSubmit({ stackAmount: Number(value.stackAmount) });
		},
		validators: {
			onSubmit: stackQuickInputSchema,
		},
	});

	useEffect(() => {
		if (isSaving) {
			return;
		}
		form.reset({ stackAmount: toFieldValue(currentStack) });
	}, [currentStack, form, isSaving]);

	return { form };
}
