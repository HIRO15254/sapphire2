import { useState } from "react";
import type { ItemValues } from "@/features/items/hooks/use-items";
import { useItems } from "@/features/items/hooks/use-items";

export function useItemsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const {
		items,
		isLoading,
		isInitialLoadError: isError,
		retry,
		isCreatePending,
		create,
	} = useItems(null);

	const handleCreate = (values: ItemValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	return {
		items,
		isError,
		retry,
		isLoading,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
	};
}
