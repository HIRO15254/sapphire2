import { useForm } from "@tanstack/react-form";
import z from "zod";

// `.trim()` runs before the length checks so this mirrors the server exactly
// (`presetNameSchema` in packages/db/src/schemas/filter-preset.ts, and the tag
// name input, are `.trim().min(1).max(50)`). Without it a whitespace-only name
// passed here and was rejected server-side, surfacing as a generic toast
// instead of an inline field error.
// Built from the resolved label so the validation copy always names the field
// the user is actually looking at — the presets sheet renders this form as
// "Preset name", and a hardcoded "Tag name is required" under it read as a bug.
const buildTagNameFormSchema = (label: string) =>
	z.object({
		name: z
			.string()
			.trim()
			.min(1, `${label} is required`)
			.max(50, `${label} must be 50 characters or less`),
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
			onSubmit: buildTagNameFormSchema(label),
		},
	});

	return { form, label };
}
