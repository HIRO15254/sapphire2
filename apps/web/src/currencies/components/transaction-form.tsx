import { useState } from "react";
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
import { useTransactionTypes } from "@/currencies/hooks/use-transaction-types";

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

export function TransactionForm({
	onSubmit,
	onCancel,
	defaultValues,
	isLoading = false,
}: TransactionFormProps) {
	const { types, createType, isCreatingType } = useTransactionTypes();
	const [selectedType, setSelectedType] = useState(
		defaultValues?.transactionTypeId ?? ""
	);
	const [newTypeName, setNewTypeName] = useState("");

	const isNewType = selectedType === NEW_TYPE_VALUE;

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const amount = Number(formData.get("amount"));
		const transactedAt = formData.get("transactedAt") as string;
		const memo = (formData.get("memo") as string) || undefined;

		let transactionTypeId = selectedType;

		if (isNewType) {
			if (!newTypeName.trim()) {
				return;
			}
			const created = await createType(newTypeName.trim());
			transactionTypeId = created.id;
		}

		onSubmit({ amount, transactionTypeId, transactedAt, memo });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="amount" label="Amount" required>
				<Input
					defaultValue={defaultValues?.amount}
					id="amount"
					name="amount"
					placeholder="Enter amount (negative for withdrawal)"
					required
					type="number"
				/>
			</Field>
			<Field htmlFor="transactionTypeId" label="Type" required>
				<Select onValueChange={setSelectedType} required value={selectedType}>
					<SelectTrigger className="w-full" id="transactionTypeId">
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
			{isNewType && (
				<Field htmlFor="newTypeName" label="New Type Name">
					<Input
						id="newTypeName"
						onChange={(e) => setNewTypeName(e.target.value)}
						placeholder="Enter new type name"
						required
						value={newTypeName}
					/>
				</Field>
			)}
			<Field htmlFor="transactedAt" label="Date" required>
				<Input
					defaultValue={
						defaultValues?.transactedAt
							? new Date(defaultValues.transactedAt).toISOString().slice(0, 10)
							: todayISODate()
					}
					id="transactedAt"
					name="transactedAt"
					required
					type="date"
				/>
			</Field>
			<Field htmlFor="memo" label="Memo">
				<Textarea
					defaultValue={defaultValues?.memo}
					id="memo"
					name="memo"
					placeholder="Optional note"
				/>
			</Field>
			<DialogActionRow>
				{onCancel ? (
					<Button onClick={onCancel} type="button" variant="outline">
						Cancel
					</Button>
				) : null}
				<Button disabled={isLoading || isCreatingType} type="submit">
					{getButtonLabel(isCreatingType, isLoading)}
				</Button>
			</DialogActionRow>
		</form>
	);
}
