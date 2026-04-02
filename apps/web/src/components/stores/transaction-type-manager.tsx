import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc, trpcClient } from "@/utils/trpc";

export function TransactionTypeManager() {
	const queryClient = useQueryClient();
	const typeListKey = trpc.transactionType.list.queryOptions().queryKey;

	const typesQuery = useQuery(trpc.transactionType.list.queryOptions());
	const types = typesQuery.data ?? [];
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const updateMutation = useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			trpcClient.transactionType.update.mutate({ id, name }),
		onMutate: async ({ id, name }) => {
			await queryClient.cancelQueries({ queryKey: typeListKey });
			const previous = queryClient.getQueryData(typeListKey);
			queryClient.setQueryData(typeListKey, (old) =>
				old?.map((t) => (t.id === id ? { ...t, name } : t))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(typeListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: typeListKey });
		},
		onSuccess: () => {
			setEditingId(null);
			setEditingName("");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.transactionType.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: typeListKey });
			const previous = queryClient.getQueryData(typeListKey);
			queryClient.setQueryData(typeListKey, (old) =>
				old?.filter((t) => t.id !== id)
			);
			return { previous };
		},
		onError: (err: unknown, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(typeListKey, context.previous);
			}
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
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: typeListKey });
		},
		onSuccess: () => {
			setConfirmingDeleteId(null);
		},
	});

	const startEdit = (id: string, name: string) => {
		setEditingId(id);
		setEditingName(name);
	};

	const handleUpdate = () => {
		if (!(editingId && editingName.trim())) {
			return;
		}
		updateMutation.mutate({ id: editingId, name: editingName.trim() });
	};

	const handleDelete = (id: string) => {
		setDeleteError(null);
		deleteMutation.mutate(id);
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
