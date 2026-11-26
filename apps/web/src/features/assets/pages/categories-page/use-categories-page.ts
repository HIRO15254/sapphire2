import { useState } from "react";
import {
	useWalletCategories,
	type WalletCategory,
} from "@/features/assets/hooks/use-wallet-data";
import {
	useArchiveCategory,
	useCreateCategory,
	useDeleteCategory,
	useRestoreCategory,
	useUpdateCategory,
} from "@/features/assets/hooks/use-wallet-mutations";
import type { CategoryFormSubmit } from "./category-form";

type FormTarget = { category: WalletCategory | null } | null;

export function useCategoriesPage() {
	const categoriesQuery = useWalletCategories();
	const [menuTarget, setMenuTarget] = useState<WalletCategory | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<WalletCategory | null>(null);
	const [formTarget, setFormTarget] = useState<FormTarget>(null);
	const createMutation = useCreateCategory();
	const updateMutation = useUpdateCategory();
	const archiveMutation = useArchiveCategory();
	const restoreMutation = useRestoreCategory();
	const deleteMutation = useDeleteCategory();

	const categories = categoriesQuery.data ?? [];

	const onSubmit = async (values: CategoryFormSubmit) => {
		const editing = formTarget?.category;
		if (editing) {
			await updateMutation.mutateAsync(
				{ icon: values.icon, id: editing.id, name: values.name },
				{ icon: editing.icon, name: editing.name }
			);
		} else {
			await createMutation.mutateAsync({
				icon: values.icon,
				name: values.name,
			});
		}
		setFormTarget(null);
	};

	const onToggleArchive = async () => {
		const target = menuTarget;
		setMenuTarget(null);
		if (!target) {
			return;
		}
		try {
			await (target.archivedAt === null
				? archiveMutation.mutateAsync({ id: target.id })
				: restoreMutation.mutateAsync({ id: target.id }));
			// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation handles its own error feedback.
		} catch {}
	};

	const onDelete = async () => {
		if (!deleteTarget || deleteMutation.isPending) {
			return;
		}
		try {
			await deleteMutation.mutateAsync({ id: deleteTarget.id });
			setDeleteTarget(null);
			// biome-ignore lint/suspicious/noEmptyBlockStatements: The mutation handles its own error feedback.
		} catch {}
	};

	return {
		active: categories.filter((category) => category.archivedAt === null),
		archived: categories.filter((category) => category.archivedAt !== null),
		deleteTarget,
		formCategory: formTarget?.category ?? null,
		isDeletePending: deleteMutation.isPending,
		isError: categoriesQuery.isError,
		isFormOpen: formTarget !== null,
		isFormPending: createMutation.isPending || updateMutation.isPending,
		isLoading: categoriesQuery.isPending,
		isRetrying: categoriesQuery.isFetching,
		menuTarget,
		onDelete,
		onDeleteFromMenu: () => {
			setDeleteTarget(menuTarget);
			setMenuTarget(null);
		},
		onDeleteOpenChange: (open: boolean) => {
			if (!open) {
				setDeleteTarget(null);
			}
		},
		onEditFromMenu: () => {
			setFormTarget({ category: menuTarget });
			setMenuTarget(null);
		},
		onFormOpenChange: (open: boolean) => {
			if (!open) {
				setFormTarget(null);
			}
		},
		onMenuOpenChange: (open: boolean) => {
			if (!open) {
				setMenuTarget(null);
			}
		},
		onNewCategory: () => setFormTarget({ category: null }),
		onOpenCategory: (category: WalletCategory) => () => setMenuTarget(category),
		onRetry: () => {
			categoriesQuery.refetch();
		},
		onSubmit,
		onToggleArchive,
	};
}
