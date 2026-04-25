import type { RingGame } from "@/features/stores/hooks/use-ring-games";
import { createGroupFormatter } from "@/utils/format-number";

export const VARIANT_LABELS: Record<string, string> = {
	nlh: "NLH",
};

export function variantLabel(variant: string): string {
	return VARIANT_LABELS[variant] ?? variant.toUpperCase();
}

export function formatBlindParts(game: RingGame): string {
	const fmt = createGroupFormatter([
		game.blind1,
		game.blind2,
		game.blind3,
		game.ante,
	]);
	const parts: string[] = [];
	if (game.blind1 != null) {
		parts.push(fmt(game.blind1));
	}
	if (game.blind2 != null) {
		parts.push(fmt(game.blind2));
	} else if (parts.length > 0) {
		parts.push("—");
	}
	if (game.blind3 != null) {
		parts.push(fmt(game.blind3));
	}
	return parts.join("/");
}

export function formatAnteSuffix(game: RingGame): string {
	if (game.ante == null || game.anteType == null || game.anteType === "none") {
		return "";
	}
	const fmt = createGroupFormatter([game.ante]);
	if (game.anteType === "bb") {
		return `(BBA:${fmt(game.ante)})`;
	}
	if (game.anteType === "all") {
		return `(Ante:${fmt(game.ante)})`;
	}
	return "";
}
