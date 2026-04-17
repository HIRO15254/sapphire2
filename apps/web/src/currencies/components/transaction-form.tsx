import { useForm } from "@tanstack/react-form";
import z from "zod";
import { useTransactionTypes } from "@/currencies/hooks/use-transaction-types";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

const NEW_TYPE_VALUE = "__new__";

interface TransactionFormValues {
	amount: number;
	memo?: string;
	transactedAt: string;
	transactionTypeId: string;
}

interface TransactionFormProps {
	defaultValues?: TransactionFormValues;
	isLoading?: boolean;
	onCancel?: () => void;
	onSubmit: (values: TransactionFormValues) => void;
}

function todayISODate() {
	return new Date().toISOString().slice(0, 10);
}

function getButtonLabel(
	isCreatingType: boolean,
	isLoading: boolean,
	isSubmitting: boolean
) {
	if (isCreatingType || isSubmitting) {
		return "Saving...";
	}
	if (isLoading) {
		return "Saving...";
	}
	return "Save";
}

const transactionFormSchema = z.object({
	amount: z.coerce.number({ invalid_type_error: "Amount is required" }),
	transactionTypeId: z.string().min(1, "Type is required"),
	newTypeName: z.string().optional(),
	transactedAt: z.string().min(1, "Date is required"),
	memo: z.string().optional(),
});

export function TransactionForm({
	onSubmit,
	onCancel,
	defaultValues,
	isLoading = false,
}: TransactionFormProps) {
	const { types, createType, isCreatingType } = useTransactionTypes();

	const form = useForm({
		defaultValues: {
			amount: defaultValues?.amount ?? (undefined as number | undefined),
			transactionTypeId: defaultValues?.transactionTypeId ?? "",
			newTypeName: "",
			transactedAt: defaultValues?.transactedAt
				? new Date(defaultValues.transactedAt).toISOString().slice(0, 10)
				: todayISODate(),
			memo: defaultValues?.memo ?? "",
		},
		onSubmit: async ({ value }) => {
			let transactionTypeId = value.transactionTypeId;

			if (transactionTypeId === NEW_TYPE_VALUE) {
				if (!value.newTypeName?.trim()) {
					return;
				}
				const created = await createType(value.newTypeName.trim());
				transactionTypeId = created.id;
			}

			onSubmit({
				amount: value.amount as number,
				transactionTypeId,
				transactedAt: value.transactedAt,
				memo: value.memo || undefined,
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
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) =>
								field.handleChange(
									e.target.value === "" ? undefined : Number(e.target.value)
								)
							}
							placeholder="Enter amount (negative for withdrawal)"
							type="number"
							value={field.state.value ?? ""}
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
						<Select
							name={field.name}
							onValueChange={(value) => field.handleChange(value)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue placeholder="Select type..." />
							</SelectTrigger>
							<SelectContent>
								{types.map((t) => (
									<SelectItem key={t.id} value={t.id}>
										{t.name}
									</SelectItem>
								))}
								<SelectItem value={NEW_TYPE_VALUE}>+ New type...</SelectItem>
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Subscribe selector={(state) => state.values.transactionTypeId}>
				{(transactionTypeId) =>
					transactionTypeId === NEW_TYPE_VALUE ? (
						<form.Field name="newTypeName">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label="New Type Name"
								>
									<Input
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Enter new type name"
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>
					) : null
				}
			</form.Subscribe>

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
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Memo"
					>
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

			<form.Subscribe>
				{(state) => (
					<DialogActionRow>
						{onCancel ? (
							<Button onClick={onCancel} type="button" variant="outline">
								Cancel
							</Button>
						) : null}
						<Button
							disabled={
								isLoading ||
								isCreatingType ||
								!state.canSubmit ||
								state.isSubmitting
							}
							type="submit"
						>
							{getButtonLabel(isCreatingType, isLoading, state.isSubmitting)}
						</Button>
					</DialogActionRow>
				)}
			</form.Subscribe>
		</form>
	);
}
