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
		create(values).then(
			() => setIsCreateOpen(false),
			() => {
				// The mutation cache reports the error; retain the form for retry.
			}
		);
	};

	const handleToggleFavorite = (id: string) => {
		toggleFavorite(id).catch(() => {
			// The mutation cache reports the error and the data hook rolls back.
		});
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
