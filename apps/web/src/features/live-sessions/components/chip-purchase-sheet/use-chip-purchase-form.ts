import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import z from "zod";

const chipPurchaseSchema = z.object({
	chipPurchaseOptionId: z.string().min(1, "Select a chip purchase option"),
});

function buildDefaults({ initialOptionId }: { initialOptionId?: string }) {
	return {
		chipPurchaseOptionId: initialOptionId ?? "",
	};
}

export interface ChipPurchaseFormOption {
	chips: number;
	cost: number;
	id: number;
	name: string;
}

interface UseChipPurchaseFormOptions {
	initialOptionId?: string;
	onSubmit: (purchase: { chipPurchaseOptionId: string }) => void;
	open: boolean;
}

export function useChipPurchaseForm({
	initialOptionId,
	open,
	onSubmit,
}: UseChipPurchaseFormOptions) {
	const form = useForm({
		defaultValues: buildDefaults({ initialOptionId }),
		onSubmit: ({ value }) => {
			onSubmit({ chipPurchaseOptionId: value.chipPurchaseOptionId });
		},
		validators: {
			onSubmit: chipPurchaseSchema,
		},
	});

	useEffect(() => {
		if (open) {
			form.reset(buildDefaults({ initialOptionId }));
		}
	}, [open, initialOptionId, form]);

	return { form };
}
