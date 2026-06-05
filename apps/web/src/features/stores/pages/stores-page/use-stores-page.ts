import { useState } from "react";
import type { StoreValues } from "@/features/stores/hooks/use-stores";
import { useStores } from "@/features/stores/hooks/use-stores";

export function useStoresPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const { stores, isLoading, isCreatePending, create } = useStores();

	const handleCreate = (values: StoreValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	return {
		stores,
		isLoading,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
	};
}
