import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc, trpcClient } from "@/utils/trpc";

export function TransactionTypeManager() {
	const typesQuery = useQuery(trpc.transactionType.list.queryOptions());
	const types = typesQuery.data ?? [];
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const startEdit = (id: string, name: string) => {
		setEditingId(id);
		setEditingName(name);
	};

	const handleUpdate = async () => {
		if (!(editingId && editingName.trim())) {
			return;
		}
		await trpcClient.transactionType.update.mutate({
			id: editingId,
			name: editingName.trim(),
		});
		await typesQuery.refetch();
		setEditingId(null);
		setEditingName("");
	};

	const handleDelete = async (id: string) => {
		setDeleteError(null);
		try {
			await trpcClient.transactionType.delete.mutate({ id });
			await typesQuery.refetch();
			setConfirmingDeleteId(null);
		} catch (err: unknown) {
			if (
				err &&
				typeof err === "object" &&
				"message" in err &&
				typeof err.message === "string"
			) {
				setDeleteError(err.message);
			} else {
				setDeleteError("Failed to delete");
			}
		}
	};

	return (
		<div className="flex flex-col gap-3">
			{types.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No transaction types. They will be created automatically when you
					first access the currencies page.
				</p>
			) : (
				<div className="flex flex-col gap-2">
					{types.map((t) => {
						const isEditing = editingId === t.id;
						const isConfirmingDelete = confirmingDeleteId === t.id;

						return (
							<div
								className="flex items-center gap-2 rounded-md border p-2"
								key={t.id}
							>
								{isEditing ? (
									<>
										<Input
											className="flex-1"
											onChange={(e) => setEditingName(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													handleUpdate();
												}
												if (e.key === "Escape") {
													setEditingId(null);
												}
											}}
											value={editingName}
										/>
										<Button onClick={handleUpdate} size="sm">
											Save
										</Button>
										<Button
											onClick={() => setEditingId(null)}
											size="sm"
											variant="ghost"
										>
											<IconX size={14} />
										</Button>
									</>
								) : (
									<>
										<span className="flex-1 text-sm">{t.name}</span>
										<div className="flex items-center gap-1">
											{isConfirmingDelete ? (
												<>
													<span className="text-destructive text-xs">
														Delete?
													</span>
													<Button
														aria-label="Confirm delete"
														className="text-destructive hover:text-destructive"
														onClick={() => handleDelete(t.id)}
														size="sm"
														variant="ghost"
													>
														<IconTrash size={14} />
													</Button>
													<Button
														aria-label="Cancel"
														onClick={() => {
															setConfirmingDeleteId(null);
															setDeleteError(null);
														}}
														size="sm"
														variant="ghost"
													>
														<IconX size={14} />
													</Button>
												</>
											) : (
												<>
													<Button
														aria-label="Edit type"
														onClick={() => startEdit(t.id, t.name)}
														size="sm"
														variant="ghost"
													>
														<IconEdit size={14} />
													</Button>
													<Button
														aria-label="Delete type"
														onClick={() => setConfirmingDeleteId(t.id)}
														size="sm"
														variant="ghost"
													>
														<IconTrash size={14} />
													</Button>
												</>
											)}
										</div>
									</>
								)}
							</div>
						);
					})}
				</div>
			)}
			{deleteError && <p className="text-destructive text-sm">{deleteError}</p>}
		</div>
	);
}
