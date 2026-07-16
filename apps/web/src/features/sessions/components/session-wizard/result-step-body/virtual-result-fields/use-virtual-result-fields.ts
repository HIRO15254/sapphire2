import { useItems } from "@/features/items/hooks/use-items";
import type { ItemUsageRow } from "@/features/sessions/components/session-wizard/item-usage-rows";

export interface VirtualItemOption {
	id: string;
	name: string;
}

interface UseVirtualResultFieldsOptions {
	itemUsages: ItemUsageRow[];
	selectedCurrencyId: string | undefined;
	setItemUsages: (rows: ItemUsageRow[]) => void;
}

/**
 * Row handlers + item options for the virtual item-usage editor. Only items
 * denominated in the session's currency are offered (fail closed — the
 * stats aggregation ignores mismatched-currency usages).
 */
export function useVirtualResultFields({
	itemUsages,
	selectedCurrencyId,
	setItemUsages,
}: UseVirtualResultFieldsOptions) {
	const { items } = useItems();
	const itemOptions: VirtualItemOption[] = selectedCurrencyId
		? items
				.filter((item) => item.currencyId === selectedCurrencyId)
				.map((item) => ({ id: item.id, name: item.name }))
		: [];

	const addRow = () => {
		setItemUsages([
			...itemUsages,
			{
				uid: crypto.randomUUID(),
				itemId: "",
				direction: "buy_in",
				count: "1",
			},
		]);
	};

	const removeRow = (uid: string) => {
		setItemUsages(itemUsages.filter((row) => row.uid !== uid));
	};

	const updateRow = (uid: string, patch: Partial<ItemUsageRow>) => {
		setItemUsages(
			itemUsages.map((row) => (row.uid === uid ? { ...row, ...patch } : row))
		);
	};

	return { addRow, itemOptions, removeRow, updateRow };
}
