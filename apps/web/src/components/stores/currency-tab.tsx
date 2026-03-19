import {
	IconChevronDown,
	IconChevronUp,
	IconCoins,
	IconEdit,
	IconPlus,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CurrencyForm } from "@/components/stores/currency-form";
import { TransactionForm } from "@/components/stores/transaction-form";
import { TransactionList } from "@/components/stores/transaction-list";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

interface CurrencyTabProps {
	storeId: string;
}

interface CurrencyValues {
	name: string;
	unit?: string;
}

interface TransactionValues {
	amount: number;
	memo?: string;
	transactedAt: string;
	transactionTypeId: string;
}

interface CurrencyItem {
	id: string;
	name: string;
	unit?: string | null;
}

export function CurrencyTab({ storeId }: CurrencyTabProps) {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingCurrency, setEditingCurrency] = useState<CurrencyItem | null>(
		null
	);
	const [expandedCurrencyId, setExpandedCurrencyId] = useState<string | null>(
		null
	);
	const [addTransactionCurrencyId, setAddTransactionCurrencyId] = useState<
		string | null
	>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);

	const currenciesQuery = useQuery(
		trpc.currency.listByStore.queryOptions({ storeId })
	);
	const currencies = currenciesQuery.data ?? [];

	const transactionsQuery = useQuery(
		trpc.currencyTransaction.listByCurrency.queryOptions(
			{ currencyId: expandedCurrencyId ?? "" },
			{ enabled: expandedCurrencyId !== null }
		)
	);
	const transactions = transactionsQuery.data ?? [];

	const handleCreate = async (values: CurrencyValues) => {
		setIsSubmitting(true);
		try {
			await trpcClient.currency.create.mutate({ storeId, ...values });
			await currenciesQuery.refetch();
			setIsCreateOpen(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUpdate = async (values: CurrencyValues) => {
		if (!editingCurrency) {
			return;
		}
		setIsSubmitting(true);
		try {
			await trpcClient.currency.update.mutate({
				id: editingCurrency.id,
				...values,
			});
			await currenciesQuery.refetch();
			setEditingCurrency(null);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (id: string) => {
		await trpcClient.currency.delete.mutate({ id });
		await currenciesQuery.refetch();
		setConfirmingDeleteId(null);
		if (expandedCurrencyId === id) {
			setExpandedCurrencyId(null);
		}
	};

	const handleAddTransaction = async (values: TransactionValues) => {
		if (!addTransactionCurrencyId) {
			return;
		}
		setIsSubmitting(true);
		try {
			await trpcClient.currencyTransaction.create.mutate({
				currencyId: addTransactionCurrencyId,
				...values,
			});
			await currenciesQuery.refetch();
			await transactionsQuery.refetch();
			setAddTransactionCurrencyId(null);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteTransaction = async (id: string) => {
		await trpcClient.currencyTransaction.delete.mutate({ id });
		await currenciesQuery.refetch();
		await transactionsQuery.refetch();
	};

	const toggleExpand = (id: string) => {
		setExpandedCurrencyId((prev) => (prev === id ? null : id));
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-lg">Currencies</h2>
				<Button onClick={() => setIsCreateOpen(true)} size="sm">
					<IconPlus size={16} />
					Add Currency
				</Button>
			</div>

			{currencies.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
					<IconCoins size={40} />
					<p className="text-sm">No currencies yet</p>
					<Button
						onClick={() => setIsCreateOpen(true)}
						size="sm"
						variant="outline"
					>
						<IconPlus size={16} />
						Add Currency
					</Button>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{currencies.map((c) => {
						const isExpanded = expandedCurrencyId === c.id;
						const isConfirmingDelete = confirmingDeleteId === c.id;

						return (
							<div className="rounded-lg border bg-card" key={c.id}>
								<div className="flex items-center gap-2 p-3">
									<button
										className="flex flex-1 items-center gap-2 text-left"
										onClick={() => toggleExpand(c.id)}
										type="button"
									>
										<div className="flex-1">
											<p className="font-medium">{c.name}</p>
											<p className="text-muted-foreground text-sm">
												Balance:{" "}
												<span className="font-semibold text-foreground">
													{c.balance.toLocaleString()}
													{c.unit ? ` ${c.unit}` : ""}
												</span>
											</p>
										</div>
										{isExpanded ? (
											<IconChevronUp
												className="text-muted-foreground"
												size={16}
											/>
										) : (
											<IconChevronDown
												className="text-muted-foreground"
												size={16}
											/>
										)}
									</button>

									<div className="flex items-center gap-1">
										{isConfirmingDelete ? (
											<>
												<span className="text-destructive text-xs">
													Delete?
												</span>
												<Button
													aria-label="Confirm delete currency"
													className="text-destructive hover:text-destructive"
													onClick={() => handleDelete(c.id)}
													size="sm"
													variant="ghost"
												>
													<IconTrash size={14} />
												</Button>
												<Button
													aria-label="Cancel delete"
													onClick={() => setConfirmingDeleteId(null)}
													size="sm"
													variant="ghost"
												>
													<IconX size={14} />
												</Button>
											</>
										) : (
											<>
												<Button
													aria-label="Edit currency"
													onClick={() => setEditingCurrency(c)}
													size="sm"
													variant="ghost"
												>
													<IconEdit size={14} />
												</Button>
												<Button
													aria-label="Delete currency"
													onClick={() => setConfirmingDeleteId(c.id)}
													size="sm"
													variant="ghost"
												>
													<IconTrash size={14} />
												</Button>
											</>
										)}
									</div>
								</div>

								{isExpanded && (
									<div className="border-t px-3 pb-3">
										<div className="mt-3 mb-2 flex items-center justify-between">
											<span className="font-medium text-sm">
												Transaction History
											</span>
											<Button
												onClick={() => setAddTransactionCurrencyId(c.id)}
												size="sm"
												variant="outline"
											>
												<IconPlus size={14} />
												Add
											</Button>
										</div>
										<TransactionList
											onDelete={handleDeleteTransaction}
											transactions={transactions}
										/>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="Add Currency"
			>
				<CurrencyForm isLoading={isSubmitting} onSubmit={handleCreate} />
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingCurrency(null);
					}
				}}
				open={editingCurrency !== null}
				title="Edit Currency"
			>
				{editingCurrency && (
					<CurrencyForm
						defaultValues={{
							name: editingCurrency.name,
							unit: editingCurrency.unit ?? undefined,
						}}
						isLoading={isSubmitting}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setAddTransactionCurrencyId(null);
					}
				}}
				open={addTransactionCurrencyId !== null}
				title="Add Transaction"
			>
				<TransactionForm
					isLoading={isSubmitting}
					onSubmit={handleAddTransaction}
				/>
			</ResponsiveDialog>
		</div>
	);
}
