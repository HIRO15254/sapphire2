import { useForm } from "@tanstack/react-form";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback } from "react";
import z from "zod";

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
			onSubmit(value.name.trim());
		},
		validators: {
			onSubmit: buildTagNameFormSchema(label),
		},
	});

	const onFormSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			event.stopPropagation();
			form.handleSubmit();
		},
		[form]
	);
	const onNameChange = useCallback(
		(handleChange: (value: string) => void) =>
			(event: ChangeEvent<HTMLInputElement>) =>
				handleChange(event.target.value),
		[]
	);
	return { form, label, onFormSubmit, onNameChange };
}
