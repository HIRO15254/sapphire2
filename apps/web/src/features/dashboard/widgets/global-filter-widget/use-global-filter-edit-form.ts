import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import z from "zod";
import { parseGlobalFilterConfig } from "@/features/dashboard/hooks/use-global-filter";
import type { WidgetEditProps } from "@/features/dashboard/widgets/registry";
import { optionalNumericString } from "@/shared/lib/form-fields";
import { trpc } from "@/utils/trpc";

const TYPE_VALUES = ["cash_game", "tournament"] as const;

const editFormSchema = z.object({
	typeVisible: z.boolean(),
	typeInitial: z.enum(["", ...TYPE_VALUES]),
	storeIdVisible: z.boolean(),
	storeIdInitial: z.string(),
	currencyIdVisible: z.boolean(),
	currencyIdInitial: z.string(),
	dateFromVisible: z.boolean(),
	dateFromInitial: z.string(),
	dateToVisible: z.boolean(),
	dateToInitial: z.string(),
	dateRangeDaysVisible: z.boolean(),
	dateRangeDaysInitial: optionalNumericString({
		integer: true,
		min: 1,
		max: 3650,
	}),
});

interface UseGlobalFilterEditFormOptions {
	config: WidgetEditProps["config"];
	onSave: WidgetEditProps["onSave"];
}

interface CurrencyOption {
	id: string;
	name: string;
}
interface StoreOption {
	id: string;
	name: string;
}

export function useGlobalFilterEditForm({
	config,
	onSave,
}: UseGlobalFilterEditFormOptions) {
	const parsed = parseGlobalFilterConfig(config);
	const storesQuery = useQuery(trpc.store.list.queryOptions());
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());

	const form = useForm({
		defaultValues: {
			typeVisible: parsed.type.visible,
			typeInitial: (parsed.type.initialValue ?? "") as
				| ""
				| (typeof TYPE_VALUES)[number],
			storeIdVisible: parsed.storeId.visible,
			storeIdInitial: parsed.storeId.initialValue ?? "",
			currencyIdVisible: parsed.currencyId.visible,
			currencyIdInitial: parsed.currencyId.initialValue ?? "",
			dateFromVisible: parsed.dateFrom.visible,
			dateFromInitial: parsed.dateFrom.initialValue ?? "",
			dateToVisible: parsed.dateTo.visible,
			dateToInitial: parsed.dateTo.initialValue ?? "",
			dateRangeDaysVisible: parsed.dateRangeDays.visible,
			dateRangeDaysInitial:
				parsed.dateRangeDays.initialValue === null
					? ""
					: String(parsed.dateRangeDays.initialValue),
		},
		onSubmit: async ({ value }) => {
			const dateRangeDaysTrimmed = value.dateRangeDaysInitial.trim();
			await onSave({
				type: {
					initialValue: value.typeInitial === "" ? null : value.typeInitial,
					visible: value.typeVisible,
				},
				storeId: {
					initialValue:
						value.storeIdInitial === "" ? null : value.storeIdInitial,
					visible: value.storeIdVisible,
				},
				currencyId: {
					initialValue:
						value.currencyIdInitial === "" ? null : value.currencyIdInitial,
					visible: value.currencyIdVisible,
				},
				dateFrom: {
					initialValue:
						value.dateFromInitial === "" ? null : value.dateFromInitial,
					visible: value.dateFromVisible,
				},
				dateTo: {
					initialValue: value.dateToInitial === "" ? null : value.dateToInitial,
					visible: value.dateToVisible,
				},
				dateRangeDays: {
					initialValue:
						dateRangeDaysTrimmed === ""
							? null
							: Number.parseInt(dateRangeDaysTrimmed, 10),
					visible: value.dateRangeDaysVisible,
				},
			});
		},
		validators: {
			onSubmit: editFormSchema,
		},
	});

	return {
		form,
		stores: (storesQuery.data ?? []) as StoreOption[],
		currencies: (currenciesQuery.data ?? []) as CurrencyOption[],
	};
}
