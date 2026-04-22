import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { requiredNumericString } from "@/shared/lib/form-fields";

const cashGameCompleteSchema = z.object({
	finalStack: requiredNumericString({ integer: true, min: 0 }),
});

interface UseCashGameCompleteFormOptions {
	defaultFinalStack?: number;
	onSubmit: (values: { finalStack: number }) => void;
}

export function useCashGameCompleteForm({
	defaultFinalStack,
	onSubmit,
}: UseCashGameCompleteFormOptions) {
	const form = useForm({
		defaultValues: {
			finalStack:
				defaultFinalStack === undefined ? "" : String(defaultFinalStack),
		},
		onSubmit: ({ value }) => {
			onSubmit({ finalStack: Number(value.finalStack) });
		},
		validators: {
			onSubmit: cashGameCompleteSchema,
		},
	});

	return { form };
}
