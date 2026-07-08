import { useForm } from "@tanstack/react-form";
import z from "zod";

export interface GameVariantFormValues {
	blindLabel1: string | null;
	blindLabel2: string | null;
	blindLabel3: string | null;
	name: string;
}

export interface GameVariantFormDefaultValues {
	blindLabel1?: string | null;
	blindLabel2?: string | null;
	blindLabel3?: string | null;
	name: string;
}

export interface UseGameVariantFormProps {
	defaultValues?: GameVariantFormDefaultValues;
	onSubmit: (values: GameVariantFormValues) => void;
}

export const NAME_MAX_LENGTH = 50;
export const BLIND_LABEL_MAX_LENGTH = 20;

export const gameVariantFormSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.max(NAME_MAX_LENGTH, `Up to ${NAME_MAX_LENGTH} characters`),
	// `.trim()` first so the length cap runs against the post-trim value — a
	// 20-char label surrounded by spaces is still a 20-char label, and pure
	// whitespace becomes "" (which submits as null) instead of failing the
	// length check.
	blindLabel1: z
		.string()
		.trim()
		.max(BLIND_LABEL_MAX_LENGTH, `Up to ${BLIND_LABEL_MAX_LENGTH} characters`),
	blindLabel2: z
		.string()
		.trim()
		.max(BLIND_LABEL_MAX_LENGTH, `Up to ${BLIND_LABEL_MAX_LENGTH} characters`),
	blindLabel3: z
		.string()
		.trim()
		.max(BLIND_LABEL_MAX_LENGTH, `Up to ${BLIND_LABEL_MAX_LENGTH} characters`),
});

function toNullableLabel(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

export function useGameVariantForm({
	defaultValues,
	onSubmit,
}: UseGameVariantFormProps) {
	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			blindLabel1: defaultValues?.blindLabel1 ?? "",
			blindLabel2: defaultValues?.blindLabel2 ?? "",
			blindLabel3: defaultValues?.blindLabel3 ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name.trim(),
				blindLabel1: toNullableLabel(value.blindLabel1),
				blindLabel2: toNullableLabel(value.blindLabel2),
				blindLabel3: toNullableLabel(value.blindLabel3),
			});
		},
		validators: {
			onSubmit: gameVariantFormSchema,
		},
	});

	return { form };
}
