import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { StoreValues } from "@/features/stores/hooks/use-stores";
import { useStores } from "@/features/stores/hooks/use-stores";

export function useStoreDetailPage(storeId: string) {
	const [isActionsOpen, setIsActionsOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const navigate = useNavigate();

	const {
		stores,
		isLoading,
		isUpdatePending,
		update,
		delete: deleteStore,
	} = useStores();

	const store = stores.find((s) => s.id === storeId) ?? null;

	const openEditFromActions = () => {
		setIsActionsOpen(false);
		setIsEditOpen(true);
	};

	const openDeleteFromActions = () => {
		setIsActionsOpen(false);
		setConfirmingDelete(true);
	};

	const handleEdit = (values: StoreValues) => {
		update({ id: storeId, ...values }).then(() => {
			setIsEditOpen(false);
		});
	};

	const handleConfirmDelete = () => {
		deleteStore(storeId);
		setConfirmingDelete(false);
		navigate({ to: "/stores" });
	};

	return {
		store,
		isLoading,
		isUpdatePending,
		isActionsOpen,
		isEditOpen,
		confirmingDelete,
		setIsActionsOpen,
		setIsEditOpen,
		setConfirmingDelete,
		openEditFromActions,
		openDeleteFromActions,
		handleEdit,
		handleConfirmDelete,
	};
}
