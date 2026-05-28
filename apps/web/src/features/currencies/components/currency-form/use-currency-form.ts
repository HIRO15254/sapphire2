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

const ASCII_PRINTABLE_RE = /^[\x20-\x7e]*$/;

export const UNIT_MAX_LENGTH = 4;

export const currencyFormSchema = z.object({
	name: z.string().min(1, "Currency name is required"),
	unit: z
		.string()
		.max(UNIT_MAX_LENGTH, `Up to ${UNIT_MAX_LENGTH} characters`)
		.regex(ASCII_PRINTABLE_RE, "Half-width characters only"),
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
