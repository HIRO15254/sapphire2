import { useState } from "react";
import type { StoreItem, StoreValues } from "@/stores/hooks/use-stores";
import { useStores } from "@/stores/hooks/use-stores";

export function useStoresPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingStore, setEditingStore] = useState<StoreItem | null>(null);

	const {
		stores,
		isCreatePending,
		isUpdatePending,
		create,
		update,
		delete: deleteStore,
	} = useStores();

	const handleCreate = (values: StoreValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	const handleUpdate = (values: StoreValues) => {
		if (!editingStore) {
			return;
		}
		update({ id: editingStore.id, ...values }).then(() => {
			setEditingStore(null);
		});
	};

	const handleDelete = (id: string) => {
		deleteStore(id);
	};

	const handleCloseEdit = () => {
		setEditingStore(null);
	};

	return {
		stores,
		isCreatePending,
		isUpdatePending,
		isCreateOpen,
		editingStore,
		setIsCreateOpen,
		setEditingStore,
		handleCreate,
		handleUpdate,
		handleDelete,
		handleCloseEdit,
	};
}
