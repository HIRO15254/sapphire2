import type { HistoryItem } from "@/features/assets/hooks/use-wallet-data";

export type WalletHistoryItem = Extract<HistoryItem, { kind: "wallet" }>;
export type WalletLine = WalletHistoryItem["line"];

export type LedgerSheetTarget =
	| { assetId: string | null; kind: "adjust"; lockAsset: boolean }
	| { fromId: string | null; kind: "exchange" }
	| { kind: "editAdjust"; line: WalletLine }
	| {
			counterpart: WalletHistoryItem["counterpart"];
			kind: "editExchange";
			line: WalletLine;
	  };

export interface AdjustSubmit {
	assetId: string;
	categoryId: string | null;
	memo: string;
	occurredAt: number;
	quantity: number;
}

export interface ExchangeSubmit {
	categoryId: string | null;
	from: { assetId: string; quantity: number };
	memo: string;
	occurredAt: number;
	to: { assetId: string; quantity: number };
}

export interface ExchangeEditSubmit {
	categoryId: string | null;
	memo: string;
	occurredAt: number;
	quantity: number;
}
