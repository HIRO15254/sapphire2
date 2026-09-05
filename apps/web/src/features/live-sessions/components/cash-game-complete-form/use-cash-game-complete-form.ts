import { useForm, useStore } from "@tanstack/react-form";
import z from "zod";
import {
	type CashEndPreview,
	computeCashEndPreview,
} from "@/features/live-sessions/utils/end-session-preview";
import { requiredNumericString } from "@/shared/lib/form-fields";

const cashGameCompleteSchema = z.object({
	finalStack: requiredNumericString({ integer: true, min: 0 }),
});

export interface CashCompletePreviewInput {
	chipRemoveTotal: number;
	evDiff: number | null;
	totalBuyIn: number;
}

interface UseCashGameCompleteFormOptions {
	defaultFinalStack?: number;
	onSubmit: (values: { finalStack: number }) => void;
	previewInput?: CashCompletePreviewInput;
}

function parseNumericField(value: string): number {
	return value.trim() === "" ? Number.NaN : Number(value);
}

export function useCashGameCompleteForm({
	defaultFinalStack,
	onSubmit,
	previewInput,
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

	const preview: CashEndPreview | null = useStore(form.store, (state) =>
		previewInput
			? computeCashEndPreview({
					cashOut: parseNumericField(state.values.finalStack),
					chipRemoveTotal: previewInput.chipRemoveTotal,
					evDiff: previewInput.evDiff,
					totalBuyIn: previewInput.totalBuyIn,
				})
			: null
	);

	return { form, preview };
}
