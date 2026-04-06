import { useState } from "react";
import { SimpleEditableList } from "@/shared/components/management/simple-editable-list";
import { type SessionTag, useSessionTags } from "@/sessions/hooks/use-session-tags";

export function SessionTagManager() {
	const { tags, update, delete: deleteTag, isUpdatePending, isDeletePending } = useSessionTags();

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);

	return (
		<SimpleEditableList
			confirmingDeleteId={confirmingDeleteId}
			editingId={editingId}
			editingValue={editingName}
			emptyDescription="Create tags when recording sessions."
			emptyHeading="No session tags yet"
			getItemLabel={(tag) => tag.name}
			isDeleting={isDeletePending}
			isSaving={isUpdatePending}
			itemNoun="tag"
			items={tags}
			onCancelDelete={() => setConfirmingDeleteId(null)}
			onCancelEditing={() => {
				setEditingId(null);
				setEditingName("");
			}}
			onConfirmDelete={(tag) =>
				deleteTag(tag.id).then(() => setConfirmingDeleteId(null))
			}
			onEditingValueChange={setEditingName}
			onSaveEditing={(tag) => {
				if (!editingName.trim()) {
					return;
				}
				update({ id: tag.id, name: editingName.trim() }).then(() => {
					setEditingId(null);
					setEditingName("");
				});
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
