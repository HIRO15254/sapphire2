import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { TransactionTypeInput } from "@/currencies/components/transaction-type-input";
import { useTransactionTypes } from "@/currencies/hooks/use-transaction-types";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { requiredNumericString } from "@/shared/lib/form-fields";

interface TransactionFormValues {
	amount: number;
	memo?: string;
	transactedAt: string;
	transactionTypeId: string;
}

interface TransactionFormProps {
	defaultValues?: TransactionFormValues;
	isLoading?: boolean;
	onSubmit: (values: TransactionFormValues) => void;
}

function todayISODate() {
	return new Date().toISOString().slice(0, 10);
}

const transactionFormSchema = z.object({
	amount: requiredNumericString(),
	transactionTypeId: z.string().min(1, "Type is required"),
	transactedAt: z.string().min(1, "Date is required"),
	memo: z.string(),
});

export function TransactionForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: TransactionFormProps) {
	const { types, createType, isCreatingType } = useTransactionTypes();

	const form = useForm({
		defaultValues: {
			amount:
				defaultValues?.amount === undefined ? "" : String(defaultValues.amount),
			transactionTypeId: defaultValues?.transactionTypeId ?? "",
			transactedAt: defaultValues?.transactedAt
				? new Date(defaultValues.transactedAt).toISOString().slice(0, 10)
				: todayISODate(),
			memo: defaultValues?.memo ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				amount: Number(value.amount),
				transactionTypeId: value.transactionTypeId,
				transactedAt: value.transactedAt,
				memo: value.memo ? value.memo : undefined,
			});
		},
		validators: {
			onSubmit: transactionFormSchema,
		},
	});

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="amount">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Amount"
						required
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Enter amount (negative for withdrawal)"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="transactionTypeId">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Type"
						required
					>
						<TransactionTypeInput
							availableTypes={types}
							id={field.name}
							onChange={(id) => field.handleChange(id)}
							onCreateType={createType}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="transactedAt">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Date"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							type="date"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="memo">
				{(field) => (
					<Field htmlFor={field.name} label="Memo">
						<Textarea
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Optional note"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<DialogActionRow>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button
							disabled={
								isLoading || isCreatingType || !canSubmit || isSubmitting
							}
							type="submit"
						>
							{isCreatingType || isLoading || isSubmitting
								? "Saving..."
								: "Save"}
						</Button>
					)}
				</form.Subscribe>
			</DialogActionRow>
		</form>
	);
}
