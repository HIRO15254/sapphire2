import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import { z } from "zod";
import { requiredNumericString } from "@/shared/lib/form-fields";

const addonSchema = z.object({
	amount: requiredNumericString({ integer: true, min: 0 }),
});

interface UseAddonFormOptions {
	initialAmount?: number;
	onSubmit: (addon: { amount: number }) => void;
	open: boolean;
}

export function useAddonForm({
	initialAmount,
	open,
	onSubmit,
}: UseAddonFormOptions) {
	const form = useForm({
		defaultValues: {
			amount: initialAmount === undefined ? "0" : String(initialAmount),
		},
		onSubmit: ({ value }) => {
			onSubmit({ amount: Math.round(Number(value.amount)) });
		},
		validators: {
			onSubmit: addonSchema,
		},
	});

	useEffect(() => {
		if (open) {
			form.reset({
				amount: initialAmount === undefined ? "0" : String(initialAmount),
			});
		}
	}, [open, initialAmount, form]);

	return { form };
}
