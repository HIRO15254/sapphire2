import { createGroupFormatter } from "@/utils/format-number";

export { variantDisplayLabel as variantLabel } from "@sapphire2/db/constants/game-variants";

interface BlindFields {
	ante: number | null;
	anteType?: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
}

export function formatBlindParts(game: BlindFields): string {
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

export function formatAnteSuffix(game: BlindFields): string {
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

export interface GameGroupLike {
	ante?: number | null;
	anteType?: string | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	name?: string | null;
	variants: string[];
}

export function groupDisplayLabel(group: GameGroupLike): string {
	const trimmedName = group.name?.trim();
	if (trimmedName) {
		return trimmedName;
	}
	if (group.variants.length === 0) {
		return "—";
	}
	return group.variants.join("+");
}

export function formatGroupStakes(group: GameGroupLike): string {
	const anteType = group.anteType ?? "all";
	const visibleAnte =
		anteType === "all" || anteType === "bb" ? (group.ante ?? null) : null;
	const fields: BlindFields = {
		blind1: group.blind1 ?? null,
		blind2: group.blind2 ?? null,
		blind3: group.blind3 ?? null,
		ante: visibleAnte,
		anteType,
	};
	const parts = [formatBlindParts(fields), formatAnteSuffix(fields)].filter(
		(part) => part !== ""
	);
	return parts.length === 0 ? "—" : parts.join(" ");
}

export function formatMixSummary(
	groups: GameGroupLike[],
	maxGroups = 2
): string {
	if (groups.length === 0) {
		return "Mix";
	}

	const shown = groups.slice(0, maxGroups);
	const rendered = shown.map((group) => {
		const label = groupDisplayLabel(group);
		const stakes = formatGroupStakes(group);
		return stakes === "—" ? label : `${label} ${stakes}`;
	});

	const truncatedCount = groups.length - shown.length;
	const suffix = truncatedCount > 0 ? ` (+${truncatedCount})` : "";

	return `Mix · ${rendered.join(" · ")}${suffix}`;
}
