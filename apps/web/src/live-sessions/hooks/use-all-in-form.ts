import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import { z } from "zod";
import { requiredNumericString } from "@/shared/lib/form-fields";

interface AllIn {
	equity: number;
	potSize: number;
	trials: number;
	wins: number;
}

const DEFAULT_VALUES = {
	potSize: "0",
	trials: "1",
	equity: "0",
	wins: "0",
};

const allInSchema = z.object({
	potSize: requiredNumericString({ min: 0 }),
	trials: requiredNumericString({ integer: true, min: 1 }),
	equity: requiredNumericString({ min: 0, max: 100 }),
	wins: requiredNumericString({ min: 0 }),
});

function toFormDefaults(initial: AllIn | undefined) {
	if (!initial) {
		return DEFAULT_VALUES;
	}
	return {
		potSize: String(initial.potSize),
		trials: String(initial.trials),
		equity: String(initial.equity),
		wins: String(initial.wins),
	};
}

interface UseAllInFormOptions {
	initialValues?: AllIn;
	onSubmit: (allIn: AllIn) => void;
	open: boolean;
}

export function useAllInForm({
	initialValues,
	open,
	onSubmit,
}: UseAllInFormOptions) {
	const form = useForm({
		defaultValues: toFormDefaults(initialValues),
		onSubmit: ({ value }) => {
			onSubmit({
				potSize: Number(value.potSize),
				trials: Number(value.trials),
				equity: Number(value.equity),
				wins: Number(value.wins),
			});
		},
		validators: {
			onSubmit: allInSchema,
		},
	});

	useEffect(() => {
		if (open) {
			form.reset(toFormDefaults(initialValues));
		}
	}, [open, initialValues, form]);

	return { form };
}
