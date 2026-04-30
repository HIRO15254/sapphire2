import { useQuery } from "@tanstack/react-query";
import {
	type GlobalFilterFieldsConfig,
	type GlobalFilterKey,
	type GlobalFilterValues,
	parseGlobalFilterConfig,
	useGlobalFilterControl,
} from "@/features/dashboard/hooks/use-global-filter";
import { trpc } from "@/utils/trpc";

interface CurrencyOption {
	id: string;
	name: string;
}
interface StoreOption {
	id: string;
	name: string;
}

export const GLOBAL_FILTER_TYPE_OPTIONS: ReadonlyArray<{
	label: string;
	value: "cash_game" | "tournament";
}> = [
	{ value: "cash_game", label: "Cash Game" },
	{ value: "tournament", label: "Tournament" },
];

export const GLOBAL_FILTER_FIELD_LABELS: Record<GlobalFilterKey, string> = {
	type: "Type",
	storeId: "Store",
	currencyId: "Currency",
	dateFrom: "Date From",
	dateTo: "Date To",
	dateRangeDays: "Last N Days",
};

export interface VisibleField {
	initialValue: GlobalFilterValues[GlobalFilterKey];
	key: GlobalFilterKey;
	label: string;
}

interface UseGlobalFilterWidgetResult {
	currencies: CurrencyOption[];
	fieldsConfig: GlobalFilterFieldsConfig;
	hasAnyVisible: boolean;
	hasDirtyValues: boolean;
	onReset: () => void;
	onValueChange: <K extends GlobalFilterKey>(
		key: K,
		value: GlobalFilterValues[K]
	) => void;
	stores: StoreOption[];
	values: GlobalFilterValues;
	visibleFields: VisibleField[];
}

const FIELD_ORDER: readonly GlobalFilterKey[] = [
	"type",
	"storeId",
	"currencyId",
	"dateFrom",
	"dateTo",
	"dateRangeDays",
];

export function useGlobalFilterWidget(
	config: Record<string, unknown>
): UseGlobalFilterWidgetResult {
	const fieldsConfig = parseGlobalFilterConfig(config);
	const { values, setValue, reset } = useGlobalFilterControl();

	const visibleFields: VisibleField[] = FIELD_ORDER.filter(
		(key) => fieldsConfig[key].visible
	).map((key) => ({
		key,
		label: GLOBAL_FILTER_FIELD_LABELS[key],
		initialValue: fieldsConfig[key]
			.initialValue as GlobalFilterValues[typeof key],
	}));

	const hasDirtyValues = visibleFields.some(
		(f) => values[f.key] !== fieldsConfig[f.key].initialValue
	);

	const storesQuery = useQuery({
		...trpc.store.list.queryOptions(),
		enabled: fieldsConfig.storeId.visible,
	});
	const currenciesQuery = useQuery({
		...trpc.currency.list.queryOptions(),
		enabled: fieldsConfig.currencyId.visible,
	});

	return {
		fieldsConfig,
		hasAnyVisible: visibleFields.length > 0,
		hasDirtyValues,
		onReset: reset,
		onValueChange: setValue,
		stores: (storesQuery.data ?? []) as StoreOption[],
		currencies: (currenciesQuery.data ?? []) as CurrencyOption[],
		values,
		visibleFields,
	};
}
