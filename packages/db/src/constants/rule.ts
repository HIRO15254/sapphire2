export const RULE_PRICE_KINDS = ["entry", "reentry", "addon"] as const;
export type RulePriceKind = (typeof RULE_PRICE_KINDS)[number];

export const ANTE_TYPES = ["none", "all", "bb"] as const;

export const MIN_RULE_TABLE_SIZE = 2;
export const MAX_RULE_TABLE_SIZE = 10;
