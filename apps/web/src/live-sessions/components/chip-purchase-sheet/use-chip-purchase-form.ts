import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import z from "zod";
import { requiredNumericString } from "@/shared/lib/form-fields";

const chipPurchaseSchema = z.object({
	name: z.string().min(1, "Name is required"),
	cost: requiredNumericString({ integer: true, min: 0 }),
	chips: requiredNumericString({ integer: true, min: 0 }),
});

function buildDefaults({
	initialValues,
	defaultName,
	defaultCost,
	defaultChips,
}: {
	defaultChips?: number;
	defaultCost?: number;
	defaultName?: string;
	initialValues?: { name: string; cost: number; chips: number };
}) {
	return {
		name: initialValues?.name ?? defaultName ?? "",
		cost: String(initialValues?.cost ?? defaultCost ?? 0),
		chips: String(initialValues?.chips ?? defaultChips ?? 0),
	};
}

interface UseChipPurchaseFormOptions {
	defaultChips?: number;
	defaultCost?: number;
	defaultName?: string;
	initialValues?: { name: string; cost: number; chips: number };
	onSubmit: (purchase: { name: string; cost: number; chips: number }) => void;
	open: boolean;
}

export function useChipPurchaseForm({
	defaultChips,
	defaultCost,
	defaultName,
	initialValues,
	open,
	onSubmit,
}: UseChipPurchaseFormOptions) {
	const form = useForm({
		defaultValues: buildDefaults({
			defaultChips,
			defaultCost,
			defaultName,
			initialValues,
		}),
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				cost: Math.round(Number(value.cost)),
				chips: Math.round(Number(value.chips)),
			});
		},
		validators: {
			onSubmit: chipPurchaseSchema,
		},
	});

	useEffect(() => {
		if (open) {
			form.reset(
				buildDefaults({ defaultChips, defaultCost, defaultName, initialValues })
			);
		}
	}, [open, defaultChips, defaultCost, defaultName, initialValues, form]);

	return { form };
}
