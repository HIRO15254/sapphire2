import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

interface ParsedConfig {
	currencyId: string | null;
}

export function parseCurrencyBalanceWidgetConfig(
	raw: Record<string, unknown>
): ParsedConfig {
	const currencyId = typeof raw.currencyId === "string" ? raw.currencyId : null;
	return { currencyId };
}

interface CurrencyOption {
	balance?: number | string | null;
	id: string;
	name: string;
	unit?: string | null;
}

interface UseCurrencyBalanceWidgetResult {
	currencies: CurrencyOption[];
	isLoading: boolean;
	selected: CurrencyOption | undefined;
}

export function useCurrencyBalanceWidget(
	config: Record<string, unknown>
): UseCurrencyBalanceWidgetResult {
	const parsed = parseCurrencyBalanceWidgetConfig(config);
	const query = useQuery(trpc.currency.list.queryOptions());
	const currencies = (query.data ?? []) as CurrencyOption[];
	const selected =
		parsed.currencyId === null
			? currencies[0]
			: currencies.find((c) => c.id === parsed.currencyId);

	return {
		currencies,
		isLoading: query.isLoading,
		selected,
	};
}

export function useCurrencyBalanceOptions(): CurrencyOption[] {
	const query = useQuery(trpc.currency.list.queryOptions());
	return (query.data ?? []) as CurrencyOption[];
}
