import type { RingGame } from "@/features/stores/hooks/use-ring-games";
import { createGroupFormatter } from "@/utils/format-number";

export function variantLabel(variant: string | null | undefined): string {
	if (!variant) {
		return "";
	}
	const VARIANT_LABELS: Record<string, string> = {
		nlh: "NLH",
	};
	return VARIANT_LABELS[variant] ?? variant.toUpperCase();
}

export function formatBlindParts(game: RingGame): string {
	const primary = game.blindSets[0];
	if (!primary) {
		return "";
	}
	const fmt = createGroupFormatter([
		primary.blind1,
		primary.blind2,
		primary.blind3,
		primary.ante,
	]);
	const parts: string[] = [];
	parts.push(fmt(primary.blind1));
	parts.push(fmt(primary.blind2));
	if (primary.blind3 != null) {
		parts.push(fmt(primary.blind3));
	}
	return parts.join("/");
}

export function formatAnteSuffix(game: RingGame): string {
	const primary = game.blindSets[0];
	if (
		!primary ||
		primary.ante == null ||
		primary.anteType == null ||
		primary.anteType === "none"
	) {
		return "";
	}
	const fmt = createGroupFormatter([primary.ante]);
	if (primary.anteType === "bb") {
		return `(BBA:${fmt(primary.ante)})`;
	}
	if (primary.anteType === "all") {
		return `(Ante:${fmt(primary.ante)})`;
	}
	return "";
}
