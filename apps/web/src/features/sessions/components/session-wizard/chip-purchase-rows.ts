import type { SessionChipPurchaseInput } from "@/features/sessions/utils/session-form-helpers";
import type { ChipPurchaseRow } from "@/shared/components/chip-purchases-editor";
import { parseOptionalInt } from "@/shared/lib/form-fields";

function parseNonNegativeIntOrZero(value: string): number {
	const parsed = parseOptionalInt(value);
	return parsed !== undefined && parsed >= 0 ? parsed : 0;
}

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

export function toSessionChipPurchases(
	rows: ChipPurchaseRow[],
	counts: Record<string, number> = {}
): SessionChipPurchaseInput[] {
	return rows.map((row) => ({
		name: row.name,
		cost: parseNonNegativeIntOrZero(row.cost),
		chips: parseNonNegativeIntOrZero(row.chips),
		count: counts[row.uid] ?? 0,
	}));
}
