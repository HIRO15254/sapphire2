import { useState } from "react";
import { SimpleEditableList } from "@/shared/components/management/simple-editable-list";
import { useTransactionTypeManager } from "@/currencies/hooks/use-transaction-type-manager";

export function TransactionTypeManager() {
	const { types, update, delete: deleteType, isUpdatePending, isDeletePending } =
		useTransactionTypeManager();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const startEdit = (id: string, name: string) => {
		setEditingId(id);
		setEditingName(name);
		setConfirmingDeleteId(null);
		setDeleteError(null);
	};

	const handleDelete = (id: string) => {
		setDeleteError(null);
		deleteType(id).then(() => {
			setConfirmingDeleteId(null);
		}).catch((err: unknown) => {
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
		});
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
			isDeleting={isDeletePending}
			isSaving={isUpdatePending}
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
				update({ id: type.id, name: editingName.trim() }).then(() => {
					setEditingId(null);
					setEditingName("");
				});
			}}
			onStartDeleting={(type) => {
				setConfirmingDeleteId(type.id);
				setDeleteError(null);
			}}
			onStartEditing={(type) => startEdit(type.id, type.name)}
		/>
	);
}
