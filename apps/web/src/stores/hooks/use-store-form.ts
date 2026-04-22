import { useForm } from "@tanstack/react-form";
import { z } from "zod";

export interface StoreFormValues {
	memo?: string;
	name: string;
}

const storeFormSchema = z.object({
	name: z.string().min(1, "Store name is required"),
	memo: z.string(),
});

interface UseStoreFormOptions {
	defaultValues?: StoreFormValues;
	onSubmit: (values: StoreFormValues) => void;
}

export function useStoreForm({ onSubmit, defaultValues }: UseStoreFormOptions) {
	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			memo: defaultValues?.memo ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				memo: value.memo ? value.memo : undefined,
			});
		},
		validators: {
			onSubmit: storeFormSchema,
		},
	});

	return { form };
}
