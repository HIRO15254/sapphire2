import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SimpleEditableList } from "@/components/management/simple-editable-list";
import { trpc, trpcClient } from "@/utils/trpc";

interface SessionTag {
	id: string;
	name: string;
}

export function SessionTagManager() {
	const queryClient = useQueryClient();
	const tagsKey = trpc.sessionTag.list.queryOptions().queryKey;

	const tagsQuery = useQuery(trpc.sessionTag.list.queryOptions());
	const tags = (tagsQuery.data ?? []) as SessionTag[];

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);

	const updateMutation = useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			trpcClient.sessionTag.update.mutate({ id, name }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: tagsKey });
		},
		onSuccess: () => {
			setEditingId(null);
			setEditingName("");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.sessionTag.delete.mutate({ id }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: tagsKey });
		},
		onSuccess: () => {
			setConfirmingDeleteId(null);
		},
	});

	return (
		<SimpleEditableList
			confirmingDeleteId={confirmingDeleteId}
			editingId={editingId}
			editingValue={editingName}
			emptyDescription="Create tags when recording sessions."
			emptyHeading="No session tags yet"
			getItemLabel={(tag) => tag.name}
			isDeleting={deleteMutation.isPending}
			isSaving={updateMutation.isPending}
			itemNoun="tag"
			items={tags}
			onCancelDelete={() => setConfirmingDeleteId(null)}
			onCancelEditing={() => {
				setEditingId(null);
				setEditingName("");
			}}
			onConfirmDelete={(tag) => deleteMutation.mutate(tag.id)}
			onEditingValueChange={setEditingName}
			onSaveEditing={(tag) => {
				if (!editingName.trim()) {
					return;
				}
				updateMutation.mutate({ id: tag.id, name: editingName.trim() });
			}}
			onStartDeleting={(tag) => setConfirmingDeleteId(tag.id)}
			onStartEditing={(tag) => {
				setEditingId(tag.id);
				setEditingName(tag.name);
				setConfirmingDeleteId(null);
			}}
		/>
	);
}
