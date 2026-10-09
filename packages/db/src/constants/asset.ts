export const ASSET_KINDS = ["currency", "item"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_MAX_DECIMALS = 4;

export const ASSET_RATE_MAX_TERM = 1_000_000_000_000;
