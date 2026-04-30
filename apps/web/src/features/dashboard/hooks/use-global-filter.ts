import { createContext, useContext } from "react";

export type GlobalFilterSessionType = "cash_game" | "tournament";

export interface GlobalFilterValues {
	currencyId: string | null;
	dateFrom: string | null;
	dateRangeDays: number | null;
	dateTo: string | null;
	storeId: string | null;
	type: GlobalFilterSessionType | null;
}

export const DEFAULT_GLOBAL_FILTER_VALUES: GlobalFilterValues = {
	type: null,
	storeId: null,
	currencyId: null,
	dateFrom: null,
	dateTo: null,
	dateRangeDays: null,
};

export const GLOBAL_FILTER_KEYS = [
	"type",
	"storeId",
	"currencyId",
	"dateFrom",
	"dateTo",
	"dateRangeDays",
] as const;

export type GlobalFilterKey = (typeof GLOBAL_FILTER_KEYS)[number];

export interface GlobalFilterFieldConfig<T> {
	initialValue: T | null;
	visible: boolean;
}

export interface GlobalFilterFieldsConfig {
	currencyId: GlobalFilterFieldConfig<string>;
	dateFrom: GlobalFilterFieldConfig<string>;
	dateRangeDays: GlobalFilterFieldConfig<number>;
	dateTo: GlobalFilterFieldConfig<string>;
	storeId: GlobalFilterFieldConfig<string>;
	type: GlobalFilterFieldConfig<GlobalFilterSessionType>;
}

const DEFAULT_FIELD: GlobalFilterFieldConfig<never> = {
	initialValue: null,
	visible: true,
};

export const DEFAULT_GLOBAL_FILTER_FIELDS_CONFIG: GlobalFilterFieldsConfig = {
	type: DEFAULT_FIELD as GlobalFilterFieldConfig<GlobalFilterSessionType>,
	storeId: DEFAULT_FIELD as GlobalFilterFieldConfig<string>,
	currencyId: DEFAULT_FIELD as GlobalFilterFieldConfig<string>,
	dateFrom: DEFAULT_FIELD as GlobalFilterFieldConfig<string>,
	dateTo: DEFAULT_FIELD as GlobalFilterFieldConfig<string>,
	dateRangeDays: DEFAULT_FIELD as GlobalFilterFieldConfig<number>,
};

interface GlobalFilterContextValue {
	reset: () => void;
	setValue: <K extends GlobalFilterKey>(
		key: K,
		value: GlobalFilterValues[K]
	) => void;
	values: GlobalFilterValues;
}

const noop = () => {
	// no-op default for tests / outside-of-provider usage
};

const GlobalFilterContext = createContext<GlobalFilterContextValue>({
	values: DEFAULT_GLOBAL_FILTER_VALUES,
	setValue: noop,
	reset: noop,
});

export const GlobalFilterProvider = GlobalFilterContext.Provider;

export function useGlobalFilter(): GlobalFilterValues {
	return useContext(GlobalFilterContext).values;
}

export function useGlobalFilterControl(): GlobalFilterContextValue {
	return useContext(GlobalFilterContext);
}

interface RawFieldShape {
	initialValue?: unknown;
	visible?: unknown;
}

function asField(raw: unknown): RawFieldShape {
	return typeof raw === "object" && raw !== null ? (raw as RawFieldShape) : {};
}

function parseStringField(raw: unknown): GlobalFilterFieldConfig<string> {
	const f = asField(raw);
	return {
		initialValue: typeof f.initialValue === "string" ? f.initialValue : null,
		visible: f.visible !== false,
	};
}

function parseTypeField(
	raw: unknown
): GlobalFilterFieldConfig<GlobalFilterSessionType> {
	const f = asField(raw);
	const initialValue =
		f.initialValue === "cash_game" || f.initialValue === "tournament"
			? f.initialValue
			: null;
	return {
		initialValue,
		visible: f.visible !== false,
	};
}

function parsePositiveIntField(raw: unknown): GlobalFilterFieldConfig<number> {
	const f = asField(raw);
	const isValidInt =
		typeof f.initialValue === "number" &&
		Number.isFinite(f.initialValue) &&
		f.initialValue >= 1;
	return {
		initialValue: isValidInt ? Math.floor(f.initialValue as number) : null,
		visible: f.visible !== false,
	};
}

export function parseGlobalFilterConfig(
	raw: Record<string, unknown>
): GlobalFilterFieldsConfig {
	return {
		type: parseTypeField(raw.type),
		storeId: parseStringField(raw.storeId),
		currencyId: parseStringField(raw.currencyId),
		dateFrom: parseStringField(raw.dateFrom),
		dateTo: parseStringField(raw.dateTo),
		dateRangeDays: parsePositiveIntField(raw.dateRangeDays),
	};
}

interface WidgetLike {
	config: Record<string, unknown>;
	type: string;
}

export function findGlobalFilterWidget(
	widgets: readonly WidgetLike[]
): WidgetLike | undefined {
	return widgets.find((w) => w.type === "global_filter");
}

export function resolveGlobalFilterFromWidgets(
	widgets: readonly WidgetLike[]
): GlobalFilterFieldsConfig {
	const widget = findGlobalFilterWidget(widgets);
	if (!widget) {
		return DEFAULT_GLOBAL_FILTER_FIELDS_CONFIG;
	}
	return parseGlobalFilterConfig(widget.config);
}

export function configToInitialValues(
	config: GlobalFilterFieldsConfig
): GlobalFilterValues {
	return {
		type: config.type.initialValue,
		storeId: config.storeId.initialValue,
		currencyId: config.currencyId.initialValue,
		dateFrom: config.dateFrom.initialValue,
		dateTo: config.dateTo.initialValue,
		dateRangeDays: config.dateRangeDays.initialValue,
	};
}

export function isoDateToEpochSeconds(
	value: string | null,
	endOfDay = false
): number | undefined {
	if (!value) {
		return undefined;
	}
	const suffix = endOfDay ? "T23:59:59" : "T00:00:00";
	const parsed = new Date(`${value}${suffix}`).getTime();
	if (!Number.isFinite(parsed)) {
		return undefined;
	}
	return Math.floor(parsed / 1000);
}

export function resolveDateFromEpoch(
	values: GlobalFilterValues,
	localDateRangeDays: number | null = null
): number | undefined {
	if (values.dateFrom) {
		return isoDateToEpochSeconds(values.dateFrom);
	}
	if (values.dateRangeDays !== null) {
		return Math.floor(Date.now() / 1000) - values.dateRangeDays * 86_400;
	}
	if (localDateRangeDays !== null) {
		return Math.floor(Date.now() / 1000) - localDateRangeDays * 86_400;
	}
	return undefined;
}

export function resolveDateToEpoch(
	values: GlobalFilterValues
): number | undefined {
	return isoDateToEpochSeconds(values.dateTo, true);
}

export function resolveSessionType<T extends GlobalFilterSessionType | "all">(
	local: T,
	values: GlobalFilterValues
): T | GlobalFilterSessionType {
	if (values.type !== null) {
		return values.type;
	}
	return local;
}
