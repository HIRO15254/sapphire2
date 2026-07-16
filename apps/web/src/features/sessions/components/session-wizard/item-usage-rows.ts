import type { SessionItemUsageFormInput } from "@/features/sessions/utils/session-form-helpers";
import { parseOptionalInt } from "@/shared/lib/form-fields";

/** One editable virtual item-usage row. `count` is a string cell for the
 * `inputMode="numeric"` text input; rows are keyed by a stable `uid`. */
export interface ItemUsageRow {
	count: string;
	direction: "buy_in" | "cash_out";
	itemId: string;
	uid: string;
}

/** Adapt saved usages to editable rows (mirrors `toChipPurchaseRows`). */
export function toItemUsageRows(
	usages: SessionItemUsageFormInput[]
): ItemUsageRow[] {
	return usages.map((usage) => ({
		uid: crypto.randomUUID(),
		itemId: usage.itemId,
		direction: usage.direction,
		count: String(usage.count),
	}));
}

/**
 * Strip the editor-only `uid` and parse cells back to the payload shape.
 * Incomplete rows (no item picked, or a count that isn't a positive
 * integer) are dropped rather than sent as invalid input.
 */
export function toSessionItemUsages(
	rows: ItemUsageRow[]
): SessionItemUsageFormInput[] {
	const usages: SessionItemUsageFormInput[] = [];
	for (const row of rows) {
		if (row.itemId === "") {
			continue;
		}
		const count = parseOptionalInt(row.count);
		if (count === undefined || count < 1) {
			continue;
		}
		usages.push({ itemId: row.itemId, direction: row.direction, count });
	}
	return usages;
}
