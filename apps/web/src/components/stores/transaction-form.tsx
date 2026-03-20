import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc, trpcClient } from "@/utils/trpc";

const NEW_TYPE_VALUE = "__new__";

interface TransactionFormValues {
	amount: number;
	memo?: string;
	transactedAt: string;
	transactionTypeId: string;
}

interface TransactionFormProps {
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
	return "Add Transaction";
}

export function TransactionForm({
	onSubmit,
	isLoading = false,
}: TransactionFormProps) {
	const typesQuery = useQuery(trpc.transactionType.list.queryOptions());
	const types = typesQuery.data ?? [];
	const [selectedType, setSelectedType] = useState("");
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
				<Label htmlFor="amount">Amount</Label>
				<Input
					id="amount"
					name="amount"
					placeholder="Enter amount (negative for withdrawal)"
					required
					type="number"
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="transactionTypeId">Type</Label>
				<select
					className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					id="transactionTypeId"
					onChange={(e) => setSelectedType(e.target.value)}
					required
					value={selectedType}
				>
					<option value="">Select type...</option>
					{types.map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
					<option value={NEW_TYPE_VALUE}>+ New type...</option>
				</select>
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
				<Label htmlFor="transactedAt">Date</Label>
				<Input
					defaultValue={todayISODate()}
					id="transactedAt"
					name="transactedAt"
					required
					type="date"
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="memo">Memo (optional)</Label>
				<Input id="memo" name="memo" placeholder="Optional note" />
			</div>
			<Button disabled={isLoading || isCreatingType} type="submit">
				{getButtonLabel(isCreatingType, isLoading)}
			</Button>
		</form>
	);
}
