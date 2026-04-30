import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import z from "zod";
import type { WidgetEditProps } from "@/features/dashboard/widgets/registry";
import { optionalNumericString } from "@/shared/lib/form-fields";
import { trpc } from "@/utils/trpc";
import {
	PNL_GRAPH_SESSION_TYPE_VALUES,
	PNL_GRAPH_UNIT_VALUES,
	PNL_GRAPH_X_AXIS_VALUES,
	type PnlGraphSessionType,
	type PnlGraphUnit,
	type PnlGraphXAxis,
	parsePnlGraphWidgetConfig,
} from "./use-pnl-graph-widget";

const editFormSchema = z.object({
	xAxis: z.enum(PNL_GRAPH_X_AXIS_VALUES as [PnlGraphXAxis, ...PnlGraphXAxis[]]),
	dateRangeDays: optionalNumericString({ integer: true, min: 1, max: 3650 }),
	sessionType: z.enum(
		PNL_GRAPH_SESSION_TYPE_VALUES as [
			PnlGraphSessionType,
			...PnlGraphSessionType[],
		]
	),
	unit: z.enum(PNL_GRAPH_UNIT_VALUES as [PnlGraphUnit, ...PnlGraphUnit[]]),
	storeId: z.string(),
	ringGameId: z.string(),
	currencyId: z.string(),
	showXAxis: z.boolean(),
	showDateRange: z.boolean(),
	showSessionType: z.boolean(),
	showUnit: z.boolean(),
	showStore: z.boolean(),
	showCurrency: z.boolean(),
});

const NONE_VALUE = "__none__";

interface RingGameItem {
	id: string;
	name: string;
	storeId?: string | null;
}

interface StoreItem {
	id: string;
	name: string;
}

interface CurrencyItem {
	id: string;
	name: string;
}

interface UsePnlGraphEditFormOptions {
	config: WidgetEditProps["config"];
	onSave: WidgetEditProps["onSave"];
}

export function usePnlGraphEditForm({
	config,
	onSave,
}: UsePnlGraphEditFormOptions) {
	const parsed = parsePnlGraphWidgetConfig(config);
	const storesQuery = useQuery(trpc.store.list.queryOptions());
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const ringGamesQuery = useQuery(
		trpc.ringGame.listByStore.queryOptions(
			{ storeId: parsed.storeId ?? "" },
			{ enabled: parsed.storeId !== null }
		)
	);

	const stores = (storesQuery.data ?? []) as StoreItem[];
	const ringGames = (ringGamesQuery.data ?? []) as RingGameItem[];
	const currencies = (currenciesQuery.data ?? []) as CurrencyItem[];

	const form = useForm({
		defaultValues: {
			xAxis: parsed.xAxis,
			dateRangeDays:
				parsed.dateRangeDays === null ? "" : String(parsed.dateRangeDays),
			sessionType: parsed.sessionType,
			unit: parsed.unit,
			storeId: parsed.storeId ?? NONE_VALUE,
			ringGameId: parsed.ringGameId ?? NONE_VALUE,
			currencyId: parsed.currencyId ?? NONE_VALUE,
			showXAxis: parsed.showFilters.xAxis,
			showDateRange: parsed.showFilters.dateRange,
			showSessionType: parsed.showFilters.sessionType,
			showUnit: parsed.showFilters.unit,
			showStore: parsed.showFilters.store,
			showCurrency: parsed.showFilters.currency,
		},
		onSubmit: async ({ value }) => {
			const trimmed = value.dateRangeDays.trim();
			await onSave({
				xAxis: value.xAxis,
				dateRangeDays: trimmed === "" ? null : Number.parseInt(trimmed, 10),
				sessionType: value.sessionType,
				unit: value.unit,
				storeId: value.storeId === NONE_VALUE ? null : value.storeId,
				ringGameId: value.ringGameId === NONE_VALUE ? null : value.ringGameId,
				currencyId: value.currencyId === NONE_VALUE ? null : value.currencyId,
				showFilters: {
					xAxis: value.showXAxis,
					dateRange: value.showDateRange,
					sessionType: value.showSessionType,
					unit: value.showUnit,
					store: value.showStore,
					currency: value.showCurrency,
				},
			});
		},
		validators: { onSubmit: editFormSchema },
	});

	return {
		currencies,
		form,
		NONE_VALUE,
		ringGames,
		stores,
	};
}
