import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useTransactionTypes } from "@/features/currencies/hooks/use-transaction-types";
import { requiredNumericString } from "@/shared/lib/form-fields";

export const NEW_TYPE_VALUE = "__new__";

export interface TransactionFormValues {
	amount: number;
	memo?: string;
	transactedAt: string;
	transactionTypeId: string;
}

export interface UseTransactionFormProps {
	defaultValues?: TransactionFormValues;
	onSubmit: (values: TransactionFormValues) => void;
}

function todayISODate() {
	return new Date().toISOString().slice(0, 10);
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

export function getButtonLabel(isCreatingType: boolean, isLoading: boolean) {
	if (isCreatingType) {
		return "Creating type...";
	}
	if (isLoading) {
		return "Saving...";
	}
	return "Save";
}

export function useTransactionForm({
	defaultValues,
	onSubmit,
}: UseTransactionFormProps) {
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

	return { form, types, isCreatingType };
}
