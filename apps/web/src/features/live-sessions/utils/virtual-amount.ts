/**
 * Client-side payload shape for virtual_buy_in / virtual_cash_out events.
 * Mirrors `virtualAmountPayload` in @sapphire2/db — either item-based (all
 * item fields set, amount = count × unitValue) or pure-virtual (all item
 * fields null). For item usages the server re-resolves every snapshot field
 * from the authoritative item row, so the values sent here are only an
 * optimistic preview.
 */
export interface VirtualAmountPayload {
	amount: number;
	count: number | null;
	currencyId: string | null;
	itemId: string | null;
	itemName: string | null;
	unitValue: number | null;
}

/** The subset of an item row the virtual-amount sheet needs. */
export interface VirtualAmountItemOption {
	currencyId: string | null;
	id: string;
	name: string;
	unitValue: number;
}

export function buildItemVirtualPayload(
	item: VirtualAmountItemOption,
	count: number
): VirtualAmountPayload {
	return {
		amount: count * item.unitValue,
		itemId: item.id,
		itemName: item.name,
		count,
		unitValue: item.unitValue,
		currencyId: item.currencyId,
	};
}

export function buildPureVirtualPayload(amount: number): VirtualAmountPayload {
	return {
		amount,
		itemId: null,
		itemName: null,
		count: null,
		unitValue: null,
		currencyId: null,
	};
}

/**
 * Items offered in the virtual-amount sheet: only those denominated in the
 * session's currency (fail closed — the stats aggregation likewise ignores
 * mismatched-currency usages, so offering them would record dead data).
 */
export function filterVirtualItemsForCurrency<
	T extends { currencyId: string | null },
>(items: T[], sessionCurrencyId: string | null): T[] {
	if (sessionCurrencyId === null) {
		return [];
	}
	return items.filter((item) => item.currencyId === sessionCurrencyId);
}
