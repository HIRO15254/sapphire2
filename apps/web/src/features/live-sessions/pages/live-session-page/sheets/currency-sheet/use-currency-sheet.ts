import { useEffect, useState } from "react";
import type { CurrencyLike } from "@/features/live-sessions/utils/session-settings";

export interface CurrencyOption extends CurrencyLike {
	balance: number;
	isFavorite: boolean;
}

interface UseCurrencySheetOptions {
	currencies: readonly CurrencyOption[];
	open: boolean;
}

export function useCurrencySheet({
	currencies,
	open,
}: UseCurrencySheetOptions) {
	const [query, setQuery] = useState("");

	useEffect(() => {
		if (open) {
			setQuery("");
		}
	}, [open]);

	const needle = query.trim().toLowerCase();
	const matched =
		needle === ""
			? currencies
			: currencies.filter(
					(currency) =>
						currency.name.toLowerCase().includes(needle) ||
						(currency.unit ?? "").toLowerCase().includes(needle)
				);

	return {
		matched,
		onQueryChange: setQuery,
		query,
	};
}
