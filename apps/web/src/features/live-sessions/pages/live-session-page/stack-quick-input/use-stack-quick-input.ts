import { useForm } from "@tanstack/react-form";
import z from "zod";
import { requiredNumericString } from "@/shared/lib/form-fields";

const stackQuickInputSchema = z.object({
	stackAmount: requiredNumericString({ integer: true, min: 0 }),
});

interface UseStackQuickInputOptions {
	currentStack: number | null;
	onSubmit: (values: { stackAmount: number }) => void;
}

export function useStackQuickInput({
	currentStack,
	onSubmit,
}: UseStackQuickInputOptions) {
	const form = useForm({
		defaultValues: {
			stackAmount: currentStack === null ? "" : String(currentStack),
		},
		onSubmit: ({ value }) => {
			onSubmit({ stackAmount: Number(value.stackAmount) });
		},
		validators: {
			onSubmit: stackQuickInputSchema,
		},
	});

	return { form };
}
