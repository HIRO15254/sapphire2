import { useForm } from "@tanstack/react-form";
import z from "zod";

export interface CurrencyFormValues {
	description?: string | null;
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
	// `.trim()` first so the length cap and the printable-ASCII check
	// both run against the post-trim value — a 4-char unit surrounded
	// by spaces is still a 4-char unit, and pure whitespace becomes ""
	// (an empty optional value) instead of failing the length check.
	unit: z
		.string()
		.trim()
		.max(UNIT_MAX_LENGTH, `Up to ${UNIT_MAX_LENGTH} characters`)
		.regex(ASCII_PRINTABLE_RE, "Half-width characters only"),
	description: z.string().max(50_000).nullable(),
});

export function useCurrencyForm({
	defaultValues,
	onSubmit,
}: UseCurrencyFormProps) {
	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			unit: defaultValues?.unit ?? "",
			description: defaultValues?.description ?? (null as string | null),
		},
		onSubmit: ({ value }) => {
			const trimmedUnit = value.unit.trim();
			onSubmit({
				name: value.name,
				unit: trimmedUnit ? trimmedUnit : undefined,
				description: value.description,
			});
		},
		validators: {
			onSubmit: currencyFormSchema,
		},
	});

	return { form };
}
