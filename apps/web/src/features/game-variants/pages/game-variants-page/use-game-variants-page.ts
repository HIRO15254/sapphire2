import { useState } from "react";
import type { GameVariantValues } from "@/features/game-variants/hooks/use-game-variants";
import { useGameVariants } from "@/features/game-variants/hooks/use-game-variants";
import type { GameVariantRow } from "./types";

export function useGameVariantsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingVariant, setEditingVariant] = useState<GameVariantRow | null>(
		null
	);
	const [pendingDelete, setPendingDelete] = useState<GameVariantRow | null>(
		null
	);
	const [showArchived, setShowArchived] = useState(false);

	const {
		variants,
		isPending,
		isCreatePending,
		isUpdatePending,
		isArchivePending,
		isRestorePending,
		isDeletePending,
		onCreate,
		onUpdate,
		onArchive,
		onRestore,
		onDelete,
	} = useGameVariants({ includeArchived: true });

	const activeVariants = variants.filter((v) => v.archivedAt === null);
	const archivedVariants = variants.filter((v) => v.archivedAt !== null);

	const toggleArchived = () => setShowArchived((prev) => !prev);

	const handleCreate = (values: GameVariantValues) => {
		onCreate(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	const handleUpdate = (values: GameVariantValues) => {
		if (!editingVariant) {
			return;
		}
		onUpdate({ id: editingVariant.id, ...values }).then(() => {
			setEditingVariant(null);
		});
	};

	const handleArchive = (id: string) => {
		onArchive(id);
	};

	const handleRestore = (id: string) => {
		onRestore(id);
	};

	const openDelete = (variant: GameVariantRow) => setPendingDelete(variant);
	const cancelDelete = () => setPendingDelete(null);

	const handleConfirmDelete = () => {
		if (!pendingDelete) {
			return;
		}
		onDelete(pendingDelete.id);
		setPendingDelete(null);
	};

	return {
		activeVariants,
		archivedVariants,
		cancelDelete,
		editingVariant,
		handleArchive,
		handleConfirmDelete,
		handleCreate,
		handleRestore,
		handleUpdate,
		isArchivePending,
		isCreateOpen,
		isCreatePending,
		isDeletePending,
		isLoading: isPending,
		isRestorePending,
		isUpdatePending,
		openDelete,
		pendingDelete,
		setEditingVariant,
		setIsCreateOpen,
		showArchived,
		toggleArchived,
	};
}
