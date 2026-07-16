import { useState } from "react";
import type { CurrencyValues } from "@/features/currencies/hooks/use-currencies";
import { useCurrencies } from "@/features/currencies/hooks/use-currencies";

export function useCurrenciesPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const {
		currencies,
		isLoading,
		isInitialLoadError: isError,
		retry,
		isCreatePending,
		create,
		toggleFavorite,
	} = useCurrencies(null);

	const handleCreate = (values: CurrencyValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	const handleToggleFavorite = (id: string) => {
		toggleFavorite(id);
	};

	return {
		currencies,
		isError,
		retry,
		isLoading,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
		handleToggleFavorite,
	};
}
