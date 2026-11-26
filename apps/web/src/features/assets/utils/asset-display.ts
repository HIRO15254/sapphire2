import {
	type Icon,
	IconCoin,
	IconCurrencyYen,
	IconTicket,
} from "@tabler/icons-react";

interface DisplayAsset {
	kind: "currency" | "item";
	name: string;
	unit: string | null;
}

export function assetIcon(asset: DisplayAsset): Icon {
	if (asset.kind === "item") {
		return IconTicket;
	}
	return asset.unit === "¥" ? IconCurrencyYen : IconCoin;
}

export function unitOrName(asset: DisplayAsset | undefined): string {
	if (!asset) {
		return "?";
	}
	return asset.unit || asset.name;
}
