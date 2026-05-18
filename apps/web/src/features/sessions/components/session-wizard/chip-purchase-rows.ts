import type { SessionChipPurchaseInput } from "@/features/sessions/utils/session-form-helpers";
import type { ChipPurchaseRow } from "@/features/stores/components/chip-purchases-editor";

function parseIntOrZero(value: string): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Adapt a chip-purchase snapshot to the `ChipPurchaseRow` shape the shared
 * `ChipPurchasesEditor` expects, plus a `counts` map (`uid` → purchase
 * count) carrying the per-purchase result. The editor keys rows by a
 * stable `uid`, so each row gets a fresh uuid; numeric cells become
 * strings to satisfy the `inputMode="numeric"` text inputs. `count` is
 * kept out of `ChipPurchaseRow` because that type is shared with the
 * Stores tournament form, where a result count is meaningless.
 */
export function toChipPurchaseRows(
	purchases: Array<{
		chips: number;
		cost: number;
		count?: number;
		name: string;
	}>
): { counts: Record<string, number>; rows: ChipPurchaseRow[] } {
	const rows: ChipPurchaseRow[] = [];
	const counts: Record<string, number> = {};
	for (const p of purchases) {
		const uid = crypto.randomUUID();
		rows.push({
			uid,
			name: p.name,
			cost: p.cost === 0 ? "" : String(p.cost),
			chips: p.chips === 0 ? "" : String(p.chips),
		});
		counts[uid] = p.count ?? 0;
	}
	return { rows, counts };
}

/**
 * Strip the editor-only `uid` and parse cells back to the payload shape.
 * `counts` maps a row `uid` to its purchase count (the session result);
 * rows absent from the map default to a count of 0.
 */
export function toSessionChipPurchases(
	rows: ChipPurchaseRow[],
	counts: Record<string, number> = {}
): SessionChipPurchaseInput[] {
	return rows.map((row) => ({
		name: row.name,
		cost: parseIntOrZero(row.cost),
		chips: parseIntOrZero(row.chips),
		count: counts[row.uid] ?? 0,
	}));
}
