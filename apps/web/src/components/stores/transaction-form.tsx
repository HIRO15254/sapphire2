import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { trpc, trpcClient } from "@/utils/trpc";

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
	defaultValues,
	isLoading = false,
}: TransactionFormProps) {
	const typesQuery = useQuery(trpc.transactionType.list.queryOptions());
	const types = typesQuery.data ?? [];
	const [selectedType, setSelectedType] = useState(
		defaultValues?.transactionTypeId ?? ""
	);
	const [newTypeName, setNewTypeName] = useState("");
	const [isCreatingType, setIsCreatingType] = useState(false);

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
			setIsCreatingType(true);
			try {
				const created = await trpcClient.transactionType.create.mutate({
					name: newTypeName.trim(),
				});
				transactionTypeId = created.id;
				await typesQuery.refetch();
			} finally {
				setIsCreatingType(false);
			}
		}

		onSubmit({ amount, transactionTypeId, transactedAt, memo });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="amount">
					Amount <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.amount}
					id="amount"
					name="amount"
					placeholder="Enter amount (negative for withdrawal)"
					required
					type="number"
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="transactionTypeId">
					Type <span className="text-destructive">*</span>
				</Label>
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
			</div>
			{isNewType && (
				<div className="flex flex-col gap-2">
					<Label htmlFor="newTypeName">New Type Name</Label>
					<Input
						id="newTypeName"
						onChange={(e) => setNewTypeName(e.target.value)}
						placeholder="Enter new type name"
						required
						value={newTypeName}
					/>
				</div>
			)}
			<div className="flex flex-col gap-2">
				<Label htmlFor="transactedAt">
					Date <span className="text-destructive">*</span>
				</Label>
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
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="memo">Memo</Label>
				<Input
					defaultValue={defaultValues?.memo}
					id="memo"
					name="memo"
					placeholder="Optional note"
				/>
			</div>
			<Button disabled={isLoading || isCreatingType} type="submit">
				{getButtonLabel(isCreatingType, isLoading)}
			</Button>
		</form>
	);
}
