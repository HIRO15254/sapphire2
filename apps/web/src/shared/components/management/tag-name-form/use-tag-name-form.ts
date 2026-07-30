import { useForm } from "@tanstack/react-form";
import z from "zod";

// `.trim()` runs before the length checks so this mirrors the server exactly
// (`presetNameSchema` in packages/db/src/schemas/filter-preset.ts, and the tag
// name input, are `.trim().min(1).max(50)`). Without it a whitespace-only name
// passed here and was rejected server-side, surfacing as a generic toast
// instead of an inline field error.
const tagNameFormSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Tag name is required")
		.max(50, "Tag name must be 50 characters or less"),
});

interface UseTagNameFormOptions {
	defaultName?: string;
	/** Field label override. Defaults to "Tag name" when omitted. */
	label?: string;
	onSubmit: (name: string) => void;
}

export function useTagNameForm({
	defaultName,
	label = "Tag name",
	onSubmit,
}: UseTagNameFormOptions) {
	const form = useForm({
		defaultValues: {
			name: defaultName ?? "",
		},
		onSubmit: ({ value }) => {
			// The validator's trimmed output is not written back into form state,
			// so trim here too — the caller must receive what the schema validated.
			onSubmit(value.name.trim());
		},
		validators: {
			onSubmit: tagNameFormSchema,
		},
	});

	return { form, label };
}
