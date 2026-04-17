import { useForm } from "@tanstack/react-form";
import { z } from "zod";
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
import { requiredNumericString } from "@/shared/lib/form-fields";

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

function getButtonLabel(isCreatingType: boolean, isLoading: boolean) {
	if (isCreatingType) {
		return "Creating type...";
	}
	if (isLoading) {
		return "Saving...";
	}
	return "Save";
}

function buildSchema() {
	return z
		.object({
			amount: requiredNumericString(),
			transactionTypeId: z.string().min(1, "Type is required"),
			newTypeName: z.string(),
			transactedAt: z.string().min(1, "Date is required"),
			memo: z.string(),
		})
		.superRefine((value, ctx) => {
			if (
				value.transactionTypeId === NEW_TYPE_VALUE &&
				value.newTypeName.trim() === ""
			) {
				ctx.addIssue({
					code: "custom",
					path: ["newTypeName"],
					message: "New type name is required",
				});
			}
		});
}

export function TransactionForm({
	onSubmit,
	onCancel,
	defaultValues,
	isLoading = false,
}: TransactionFormProps) {
	const { types, createType, isCreatingType } = useTransactionTypes();

	const form = useForm({
		defaultValues: {
			amount:
				defaultValues?.amount === undefined ? "" : String(defaultValues.amount),
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
				const created = await createType(value.newTypeName.trim());
				transactionTypeId = created.id;
			}
			onSubmit({
				amount: Number(value.amount),
				transactionTypeId,
				transactedAt: value.transactedAt,
				memo: value.memo ? value.memo : undefined,
			});
		},
		validators: {
			onSubmit: buildSchema(),
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
						<Select
							onValueChange={(v) => field.handleChange(v)}
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
			<form.Subscribe
				selector={(state) => state.values.transactionTypeId === NEW_TYPE_VALUE}
			>
				{(isNewType) =>
					isNewType ? (
						<form.Field name="newTypeName">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label="New Type Name"
								>
									<Input
										id={field.name}
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
				{onCancel ? (
					<Button onClick={onCancel} type="button" variant="outline">
						Cancel
					</Button>
				) : null}
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
							{getButtonLabel(isCreatingType, isLoading)}
						</Button>
					)}
				</form.Subscribe>
			</DialogActionRow>
		</form>
	);
}
