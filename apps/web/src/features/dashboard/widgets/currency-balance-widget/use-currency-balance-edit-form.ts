import { useForm } from "@tanstack/react-form";
import type { WidgetEditProps } from "@/features/dashboard/widgets/registry";
import { useCurrencyBalanceOptions } from "./use-currency-balance-widget";

const FIRST_AVAILABLE = "__first__";

interface UseCurrencyBalanceEditFormOptions {
	config: WidgetEditProps["config"];
	onSave: WidgetEditProps["onSave"];
}

export function useCurrencyBalanceEditForm({
	config,
	onSave,
}: UseCurrencyBalanceEditFormOptions) {
	const currencies = useCurrencyBalanceOptions();
	const initialCurrencyId =
		typeof config.currencyId === "string" ? config.currencyId : FIRST_AVAILABLE;

	const form = useForm({
		defaultValues: {
			currencyId: initialCurrencyId,
		},
		onSubmit: async ({ value }) => {
			await onSave({
				currencyId:
					value.currencyId === FIRST_AVAILABLE ? null : value.currencyId,
			});
		},
	});

	return { form, currencies, FIRST_AVAILABLE };
}
