import type {
	HistoryItem,
	WalletAsset,
	WalletCategory,
} from "@/features/assets/hooks/use-wallet-data";
import { formatSignedQuantity } from "./amount";
import { dayLabel, monthKey, monthLabel } from "./dates";

type WalletItem = Extract<HistoryItem, { kind: "wallet" }>;

export type HistoryIcon =
	| { kind: "cash" | "exchange" | "plusMinus" | "tournament" }
	| { kind: "category"; name: string };

export interface HistoryRow {
	amount: string;
	icon: HistoryIcon;
	key: string;
	live: boolean;
	meta: string;
	title: string;
	tone: "default" | "destructive" | "success";
	wallet: WalletItem | null;
}

export interface HistoryGroup {
	key: string;
	label: string;
	rows: HistoryRow[];
}

function joinMeta(parts: (string | null | undefined)[]) {
	return parts.filter(Boolean).join(" · ");
}

type EntryItem = Extract<HistoryItem, { kind: "entry" }>;

function entryTone(item: EntryItem): HistoryRow["tone"] {
	if (item.isOpen || item.quantity === 0) {
		return "default";
	}
	return item.quantity > 0 ? "success" : "destructive";
}

function entryRow(
	item: EntryItem,
	asset: WalletAsset,
	day: string
): HistoryRow {
	return {
		amount: formatSignedQuantity(item.quantity, asset),
		icon: { kind: item.entryKind === "tournament" ? "tournament" : "cash" },
		key: `entry-${item.id}`,
		live: item.isOpen,
		meta: joinMeta([day, "Session"]),
		title: item.title ?? "Session",
		tone: entryTone(item),
		wallet: null,
	};
}

function exchangeRow(
	item: WalletItem,
	asset: WalletAsset,
	assets: readonly WalletAsset[],
	day: string
): HistoryRow {
	const { counterpart, line } = item;
	const other = counterpart
		? assets.find((candidate) => candidate.id === counterpart.assetId)
		: undefined;
	const otherAmount =
		counterpart && other
			? formatSignedQuantity(counterpart.quantity, other)
			: null;
	return {
		amount: formatSignedQuantity(line.quantity, asset),
		icon: { kind: "exchange" },
		key: `line-${line.id}`,
		live: false,
		meta: joinMeta([day, "Exchange", otherAmount, line.memo]),
		title: `${line.quantity > 0 ? "From" : "To"} ${other?.name ?? "another asset"}`,
		tone: "default",
		wallet: item,
	};
}

function adjustmentRow(
	item: WalletItem,
	asset: WalletAsset,
	categories: readonly WalletCategory[],
	day: string
): HistoryRow {
	const { line } = item;
	const category = categories.find(
		(candidate) => candidate.id === line.categoryId
	);
	return {
		amount: formatSignedQuantity(line.quantity, asset),
		icon: category?.icon
			? { kind: "category", name: category.icon }
			: { kind: "plusMinus" },
		key: `line-${line.id}`,
		live: false,
		meta: joinMeta([day, "Adjustment", line.memo]),
		title: category?.name ?? "Adjustment",
		tone: "default",
		wallet: item,
	};
}

function occurredAt(item: HistoryItem): Date {
	return new Date(
		item.kind === "wallet" ? item.line.occurredAt : item.occurredAt
	);
}

function toRow(
	item: HistoryItem,
	asset: WalletAsset,
	assets: readonly WalletAsset[],
	categories: readonly WalletCategory[],
	now: Date
): HistoryRow {
	const day = dayLabel(occurredAt(item), now);
	if (item.kind === "entry") {
		return entryRow(item, asset, day);
	}
	return item.line.role === "exchange"
		? exchangeRow(item, asset, assets, day)
		: adjustmentRow(item, asset, categories, day);
}

export function buildHistoryGroups(
	items: readonly HistoryItem[],
	asset: WalletAsset,
	assets: readonly WalletAsset[],
	categories: readonly WalletCategory[],
	now: Date
): HistoryGroup[] {
	const groups: HistoryGroup[] = [];
	for (const item of items) {
		const at = occurredAt(item);
		const key = monthKey(at);
		let group = groups.at(-1);
		if (!group || group.key !== key) {
			group = { key, label: monthLabel(at), rows: [] };
			groups.push(group);
		}
		group.rows.push(toRow(item, asset, assets, categories, now));
	}
	return groups;
}
