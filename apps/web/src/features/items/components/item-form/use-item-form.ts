import { useForm } from "@tanstack/react-form";
import z from "zod";
import { useCurrencies } from "@/features/currencies/hooks/use-currencies";
import { requiredNumericString } from "@/shared/lib/form-fields";

export interface ItemFormValues {
	currencyId: string;
	description?: string | null;
	name: string;
	unitValue: number;
}

export interface UseItemFormProps {
	defaultValues?: ItemFormValues;
	onSubmit: (values: ItemFormValues) => void;
}

export const itemFormSchema = z.object({
	name: z.string().min(1, "Item name is required"),
	currencyId: z.string().min(1, "Currency is required"),
	// Mirrors the server schema (z.number().int().min(0)) so the user gets a
	// field-level error instead of an opaque server rejection.
	unitValue: requiredNumericString({ integer: true, min: 0 }),
	description: z.string().max(50_000).nullable(),
});

export function useItemForm({ defaultValues, onSubmit }: UseItemFormProps) {
	const { currencies, isLoading: isCurrenciesLoading } = useCurrencies(null);

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			currencyId: defaultValues?.currencyId ?? "",
			unitValue:
				defaultValues?.unitValue === undefined
					? ""
					: String(defaultValues.unitValue),
			description: defaultValues?.description ?? (null as string | null),
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				currencyId: value.currencyId,
				unitValue: Number(value.unitValue),
				description: value.description,
			});
		},
		validators: {
			onSubmit: itemFormSchema,
		},
	});

	return { form, currencies, isCurrenciesLoading };
}
