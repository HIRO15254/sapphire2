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

export const LEDGER_EFFECTS = ["real", "virtual"] as const;
export type LedgerEffect = (typeof LEDGER_EFFECTS)[number];

export const LEDGER_MAX_QUANTITY = 1_000_000_000_000;
