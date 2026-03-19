import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/utils/trpc";

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

export function TransactionForm({
	onSubmit,
	isLoading = false,
}: TransactionFormProps) {
	const typesQuery = useQuery(trpc.transactionType.list.queryOptions());
	const types = typesQuery.data ?? [];

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const amount = Number(formData.get("amount"));
		const transactionTypeId = formData.get("transactionTypeId") as string;
		const transactedAt = formData.get("transactedAt") as string;
		const memo = (formData.get("memo") as string) || undefined;
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
					name="transactionTypeId"
					required
				>
					<option value="">Select type...</option>
					{types.map((t) => (
						<option key={t.id} value={t.id}>
							{t.name}
						</option>
					))}
				</select>
			</div>
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
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Add Transaction"}
			</Button>
		</form>
	);
}
