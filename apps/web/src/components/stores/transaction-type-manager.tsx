import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SimpleEditableList } from "@/components/management/simple-editable-list";
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
		onError: (err: unknown) => {
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
		setConfirmingDeleteId(null);
		setDeleteError(null);
	};

	const handleDelete = (id: string) => {
		setDeleteError(null);
		deleteMutation.mutate(id);
	};

	return (
		<SimpleEditableList
			confirmingDeleteId={confirmingDeleteId}
			deleteError={deleteError}
			editingId={editingId}
			editingValue={editingName}
			emptyDescription="They will be created automatically when you first access the currencies page."
			emptyHeading="No transaction types yet"
			getItemLabel={(type) => type.name}
			isDeleting={deleteMutation.isPending}
			isSaving={updateMutation.isPending}
			itemNoun="type"
			items={types}
			onCancelDelete={() => {
				setConfirmingDeleteId(null);
				setDeleteError(null);
			}}
			onCancelEditing={() => {
				setEditingId(null);
				setEditingName("");
			}}
			onConfirmDelete={(type) => handleDelete(type.id)}
			onEditingValueChange={setEditingName}
			onSaveEditing={(type) => {
				if (!(editingId && editingName.trim())) {
					return;
				}
				updateMutation.mutate({ id: type.id, name: editingName.trim() });
			}}
			onStartDeleting={(type) => {
				setConfirmingDeleteId(type.id);
				setDeleteError(null);
			}}
			onStartEditing={(type) => startEdit(type.id, type.name)}
		/>
	);
}
