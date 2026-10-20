import type { EntryKind } from "./entry";

export const LEDGER_ROLES = [
	"buy_in",
	"reentry",
	"fee",
	"chip_purchase",
	"addon",
	"chip_remove",
	"cash_out",
	"prize",
	"bounty",
	"adjustment",
	"exchange",
] as const;
export type LedgerRole = (typeof LEDGER_ROLES)[number];

export const LEDGER_PAYMENT_ROLES = [
	"buy_in",
	"reentry",
	"fee",
	"chip_purchase",
	"addon",
] as const satisfies readonly LedgerRole[];

export const LEDGER_RECEIPT_ROLES = [
	"chip_remove",
	"cash_out",
	"prize",
	"bounty",
] as const satisfies readonly LedgerRole[];

export const LEDGER_WALLET_ROLES = [
	"adjustment",
	"exchange",
] as const satisfies readonly LedgerRole[];

export const LEDGER_PRICE_ROLES = [
	"buy_in",
	"reentry",
	"fee",
	"chip_purchase",
] as const satisfies readonly LedgerRole[];

export const LEDGER_EFFECTS = ["real", "virtual"] as const;
export type LedgerEffect = (typeof LEDGER_EFFECTS)[number];

export const LEDGER_MAX_QUANTITY = 1_000_000_000_000;

export const LEDGER_ENTRY_ROLES_BY_KIND = {
	cash: ["buy_in", "addon", "chip_remove", "cash_out"],
	tournament: ["buy_in", "reentry", "fee", "chip_purchase", "prize", "bounty"],
} as const satisfies Record<EntryKind, readonly LedgerRole[]>;

export function signedLedgerQuantity(role: LedgerRole, quantity: number) {
	return (LEDGER_PAYMENT_ROLES as readonly LedgerRole[]).includes(role)
		? -quantity
		: quantity;
}
