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

export const LEDGER_EFFECTS = ["real", "virtual"] as const;
export type LedgerEffect = (typeof LEDGER_EFFECTS)[number];
