import { useForm } from "@tanstack/react-form";
import { type ChangeEvent, type FormEvent, useState } from "react";
import z from "zod";
import type { WalletCategory } from "@/features/assets/hooks/use-wallet-data";
import { isNameConflict } from "@/features/assets/utils/form";
import { useIconSuggestion } from "@/shared/hooks/use-icon-suggestion";

const categoryFormSchema = z.object({
	icon: z.string(),
	name: z
		.string()
		.trim()
		.min(1, "Enter a name")
		.max(100, "Up to 100 characters"),
});

export interface CategoryFormSubmit {
	icon: string | null;
	name: string;
}

interface UseCategoryFormOptions {
	category: WalletCategory | null;
	onSubmit: (values: CategoryFormSubmit) => Promise<void>;
}

export function useCategoryForm({
	category,
	onSubmit,
}: UseCategoryFormOptions) {
	const [nameError, setNameError] = useState<string | null>(null);
	const form = useForm({
		defaultValues: { icon: category?.icon ?? "", name: category?.name ?? "" },
		onSubmit: async ({ value }) => {
			try {
				await onSubmit({ icon: value.icon || null, name: value.name.trim() });
			} catch (error) {
				if (isNameConflict(error)) {
					setNameError("A category with this name already exists");
				}
			}
		},
		validators: { onSubmit: categoryFormSchema },
	});
	const { onIconChosen, onNameBlur } = useIconSuggestion({
		getIcon: () => form.getFieldValue("icon"),
		getName: () => form.getFieldValue("name"),
		initialIcon: category?.icon ?? "",
		setIcon: (name) => form.setFieldValue("icon", name),
	});

	const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		form.handleSubmit();
	};

	return {
		form,
		nameError,
		onFormSubmit,
		onIconChange:
			(handleChange: (value: string) => void) => (value: string) => {
				onIconChosen();
				handleChange(value);
			},
		onNameBlur: (handleBlur: () => void) => () => {
			handleBlur();
			onNameBlur(form.getFieldValue("name"));
		},
		onNameChange:
			(handleChange: (value: string) => void) =>
			(event: ChangeEvent<HTMLInputElement>) => {
				setNameError(null);
				handleChange(event.target.value);
			},
	};
}
