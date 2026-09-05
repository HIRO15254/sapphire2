import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import z from "zod";
import type { ChipsDirection } from "@/features/live-sessions/components/event-fields/chips-direction-field";
import { requiredNumericString } from "@/shared/lib/form-fields";

const addonSchema = z.object({
	amount: requiredNumericString({ integer: true, min: 1 }),
	direction: z.enum(["add", "remove"]),
});

function toDefaults(initialAmount: number | undefined) {
	return {
		amount: initialAmount === undefined ? "" : String(Math.abs(initialAmount)),
		direction: (initialAmount !== undefined && initialAmount < 0
			? "remove"
			: "add") as ChipsDirection,
	};
}

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
		defaultValues: toDefaults(initialAmount),
		onSubmit: ({ value }) => {
			const magnitude = Math.round(Number(value.amount));
			onSubmit({
				amount: value.direction === "remove" ? -magnitude : magnitude,
			});
		},
		validators: {
			onSubmit: addonSchema,
		},
	});

	useEffect(() => {
		if (open) {
			form.reset(toDefaults(initialAmount));
		}
	}, [open, initialAmount, form]);

	return { form };
}
