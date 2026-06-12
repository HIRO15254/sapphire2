import { useForm } from "@tanstack/react-form";
import z from "zod";

const memoSchema = z.object({
	text: z.string().min(1, "Text is required"),
});

interface UseMemoFormSheetOptions {
	onSubmit: (text: string) => void;
}

export function useMemoFormSheet({ onSubmit }: UseMemoFormSheetOptions) {
	const form = useForm({
		defaultValues: { text: "" },
		onSubmit: ({ value }) => {
			onSubmit(value.text);
			form.reset();
		},
		validators: {
			onSubmit: memoSchema,
		},
	});

	return { form };
}
