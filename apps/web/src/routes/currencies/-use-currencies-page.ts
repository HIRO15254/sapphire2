import { useState } from "react";
import type { CurrencyValues } from "@/features/currencies/hooks/use-currencies";
import { useCurrencies } from "@/features/currencies/hooks/use-currencies";

export function useCurrenciesPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const { currencies, isCreatePending, create } = useCurrencies(null);

	const handleCreate = (values: CurrencyValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	return {
		currencies,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
	};
}
