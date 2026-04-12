import { useState } from "react";
import { useTransactionTypeManager } from "@/currencies/hooks/use-transaction-type-manager";
import { TagManager } from "@/shared/components/management/tag-manager";
import { TagNameForm } from "@/shared/components/management/tag-name-form";

export function TransactionTypeManager() {
	const {
		types,
		create,
		update,
		delete: deleteType,
		isCreatePending,
		isUpdatePending,
		isDeletePending,
	} = useTransactionTypeManager();

	const [deleteError, setDeleteError] = useState<string | null>(null);

	const handleDelete = async (id: string) => {
		setDeleteError(null);
		try {
			await deleteType(id);
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
			throw err;
		}
	};

	return (
		<TagManager
			deleteError={deleteError}
			emptyDescription="They will be created automatically when you first access the currencies page."
			emptyHeading="No transaction types yet"
			isDeletePending={isDeletePending}
			noun="type"
			onDelete={handleDelete}
			renderCreateForm={(onClose) => (
				<TagNameForm
					isLoading={isCreatePending}
					onSubmit={(name) => create(name).then(onClose)}
				/>
			)}
			renderDeleteDescription={(type) => (
				<p className="text-sm">
					Are you sure you want to delete the type &ldquo;{type.name}&rdquo;?
					Types in use by existing transactions cannot be deleted.
				</p>
			)}
			renderEditForm={(type, onClose) => (
				<TagNameForm
					defaultName={type.name}
					isLoading={isUpdatePending}
					onSubmit={(name) => update({ id: type.id, name }).then(onClose)}
				/>
			)}
			tags={types}
		/>
	);
}
