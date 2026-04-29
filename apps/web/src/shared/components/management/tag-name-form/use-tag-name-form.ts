import { useForm } from "@tanstack/react-form";
import z from "zod";

const tagNameFormSchema = z.object({
	name: z
		.string()
		.min(1, "Tag name is required")
		.max(50, "Tag name must be 50 characters or less"),
});

interface UseTagNameFormOptions {
	defaultName?: string;
	onSubmit: (name: string) => void;
}

export function useTagNameForm({
	defaultName,
	onSubmit,
}: UseTagNameFormOptions) {
	const form = useForm({
		defaultValues: {
			name: defaultName ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit(value.name);
		},
		validators: {
			onSubmit: tagNameFormSchema,
		},
	});

	return { form };
}
