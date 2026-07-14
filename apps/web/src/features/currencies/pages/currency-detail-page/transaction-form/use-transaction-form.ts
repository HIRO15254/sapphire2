import { useForm } from "@tanstack/react-form";
import z from "zod";
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
			amount: requiredNumericString({ integer: true }),
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

const RESERVED_TYPE_NAMES = ["Session Result"] as const;

export function useTransactionForm({
	defaultValues,
	onSubmit,
}: UseTransactionFormProps) {
	const { types: allTypes, createType, isCreatingType } = useTransactionTypes();
	const types = allTypes.filter(
		(t) =>
			!RESERVED_TYPE_NAMES.some((r) => r.toLowerCase() === t.name.toLowerCase())
	);

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
				if (!created) {
					throw new Error("Failed to create transaction type");
				}
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

	return {
		form,
		types,
		isCreatingType,
		reservedTypeNames: RESERVED_TYPE_NAMES,
	};
}
