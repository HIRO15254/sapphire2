import { useForm } from "@tanstack/react-form";
import z from "zod";

export interface CurrencyFormValues {
	name: string;
	unit?: string;
}

export interface UseCurrencyFormProps {
	defaultValues?: CurrencyFormValues;
	onSubmit: (values: CurrencyFormValues) => void;
}

export const currencyFormSchema = z.object({
	name: z.string().min(1, "Currency name is required"),
	unit: z.string(),
});

export function useCurrencyForm({
	defaultValues,
	onSubmit,
}: UseCurrencyFormProps) {
	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			unit: defaultValues?.unit ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				unit: value.unit ? value.unit : undefined,
			});
		},
		validators: {
			onSubmit: currencyFormSchema,
		},
	});

	return { form };
}
