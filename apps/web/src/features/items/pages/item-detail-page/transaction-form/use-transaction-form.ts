import { useForm } from "@tanstack/react-form";
import z from "zod";
import { requiredNumericString } from "@/shared/lib/form-fields";

export interface TransactionFormValues {
	count: number;
	memo?: string;
	transactedAt: string;
}

export interface UseTransactionFormProps {
	defaultValues?: TransactionFormValues;
	onSubmit: (values: TransactionFormValues) => void;
}

function todayISODate() {
	return new Date().toISOString().slice(0, 10);
}

// The server rejects zero counts (a no-op ledger row); mirror that here so
// the user gets a field-level error instead of an opaque server rejection.
// The empty-string guard leaves the "Required" error to the base schema.
const transactionFormSchema = z.object({
	count: requiredNumericString({ integer: true }).refine(
		(value) => value.trim() === "" || Number(value) !== 0,
		{ message: "Count must not be zero" }
	),
	transactedAt: z.string().min(1, "Date is required"),
	memo: z.string(),
});

export function useTransactionForm({
	defaultValues,
	onSubmit,
}: UseTransactionFormProps) {
	const form = useForm({
		defaultValues: {
			count:
				defaultValues?.count === undefined ? "" : String(defaultValues.count),
			transactedAt: defaultValues?.transactedAt
				? new Date(defaultValues.transactedAt).toISOString().slice(0, 10)
				: todayISODate(),
			memo: defaultValues?.memo ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				count: Number(value.count),
				transactedAt: value.transactedAt,
				memo: value.memo ? value.memo : undefined,
			});
		},
		validators: {
			onSubmit: transactionFormSchema,
		},
	});

	return { form };
}
