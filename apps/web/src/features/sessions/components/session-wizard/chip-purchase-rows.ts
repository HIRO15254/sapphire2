import type { SessionChipPurchaseInput } from "@/features/sessions/utils/session-form-helpers";
import type { ChipPurchaseRow } from "@/features/stores/components/chip-purchases-editor";

function parseIntOrZero(value: string): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Adapt the wizard's chip-purchase snapshot to the `ChipPurchaseRow`
 * shape the shared `ChipPurchasesEditor` expects. The editor keys rows
 * by a stable `uid`, so each row gets a fresh uuid; numeric cells become
 * strings to satisfy the `inputMode="numeric"` text inputs.
 */
export function toChipPurchaseRows(
	purchases: SessionChipPurchaseInput[]
): ChipPurchaseRow[] {
	return purchases.map((p) => ({
		uid: crypto.randomUUID(),
		name: p.name,
		cost: p.cost === 0 ? "" : String(p.cost),
		chips: p.chips === 0 ? "" : String(p.chips),
	}));
}

/** Strip the editor-only `uid` and parse cells back to the payload shape. */
export function toSessionChipPurchases(
	rows: ChipPurchaseRow[]
): SessionChipPurchaseInput[] {
	return rows.map((row) => ({
		name: row.name,
		cost: parseIntOrZero(row.cost),
		chips: parseIntOrZero(row.chips),
	}));
}
