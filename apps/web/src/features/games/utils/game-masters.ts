import { trpcErrorCode } from "@/shared/lib/query-failure";
import type {
	GameGroup,
	GameMix,
	GameVariant,
} from "../hooks/use-game-masters";

export type MasterKind = "group" | "mix" | "variant";

export const MAX_MIX_GAMES = 60;
export const MAX_MIX_STRUCTURES = 12;

const BLIND_FIELDS = [1, 2, 3] as const;

const ANTE_SUMMARY = {
	all: "All ante",
	bb: "BB ante",
	none: "No ante",
} as const;

const NOUNS = { group: "structure", mix: "mix", variant: "game" } as const;

export function isActive(row: { archivedAt: unknown }): boolean {
	return row.archivedAt === null;
}

export function countLabel(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function joinNames(names: string[]): string {
	if (names.length < 2) {
		return names.join("");
	}
	return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function shortName(variant: GameVariant): string {
	return variant.shortLabel ?? variant.label;
}

export function blindSummary(group: GameGroup, withAnte = false): string {
	const parts: string[] = BLIND_FIELDS.flatMap((field) => {
		const label = group[`blind${field}Label`];
		if (!label) {
			return [];
		}
		return [`${label}${group[`blind${field}Required`] ? "*" : ""}`];
	});
	if (withAnte && group.fixedAnteType) {
		parts.push(ANTE_SUMMARY[group.fixedAnteType]);
	}
	return parts.length > 0 ? parts.join(" · ") : "No blinds";
}

export function archiveVariantBlock(
	variantId: string,
	mixes: GameMix[] | undefined
): string | null {
	const names = (mixes ?? [])
		.filter((mix) => isActive(mix) && mix.games.includes(variantId))
		.map((mix) => mix.label);
	return names.length > 0 ? `Used by ${joinNames(names)}.` : null;
}

export function archiveGroupBlock(
	groupId: string,
	variants: GameVariant[] | undefined
): string | null {
	const names = (variants ?? [])
		.filter((variant) => isActive(variant) && variant.groupId === groupId)
		.map((variant) => variant.label);
	if (names.length === 0) {
		return null;
	}
	return `Still has ${names.length > 3 ? countLabel(names.length, "game") : joinNames(names)}.`;
}

export function restoreVariantBlock(
	variant: GameVariant,
	groups: GameGroup[] | undefined
): string | null {
	const group = groups?.find((row) => row.id === variant.groupId);
	return group && !isActive(group)
		? `Its structure, ${group.label}, is archived.`
		: null;
}

export function restoreMixBlock(
	mix: GameMix,
	variants: GameVariant[] | undefined
): string | null {
	const names = mix.games.flatMap((id) => {
		const variant = variants?.find((row) => row.id === id);
		return variant && !isActive(variant) ? [variant.label] : [];
	});
	if (names.length === 0) {
		return null;
	}
	return `${joinNames(names)} ${names.length === 1 ? "is" : "are"} archived.`;
}

export interface GameBucket {
	groupId: string;
	label: string;
	variants: GameVariant[];
}

export function bucketGames(
	gameIds: readonly string[],
	variants: GameVariant[],
	groups: GameGroup[] | undefined
): GameBucket[] {
	const groupIndex = new Map(groups?.map((group, index) => [group.id, index]));
	const variantIndex = new Map(
		variants.map((variant, index) => [variant.id, index])
	);
	const picked = gameIds
		.flatMap((id) => {
			const variant = variants.find((row) => row.id === id);
			return variant ? [variant] : [];
		})
		.toSorted(
			(left, right) =>
				(groupIndex.get(left.groupId) ?? Number.MAX_SAFE_INTEGER) -
					(groupIndex.get(right.groupId) ?? Number.MAX_SAFE_INTEGER) ||
				(variantIndex.get(left.id) ?? 0) - (variantIndex.get(right.id) ?? 0)
		);
	const buckets: GameBucket[] = [];
	for (const variant of picked) {
		const bucket = buckets.find((row) => row.groupId === variant.groupId);
		if (bucket) {
			bucket.variants.push(variant);
		} else {
			buckets.push({
				groupId: variant.groupId,
				label:
					groups?.find((group) => group.id === variant.groupId)?.label ??
					"Games",
				variants: [variant],
			});
		}
	}
	return buckets;
}

export function mixSummary(
	mix: GameMix,
	variants: GameVariant[] | undefined,
	groups: GameGroup[] | undefined
): string {
	if (!variants) {
		return "";
	}
	const buckets = bucketGames(mix.games, variants, groups);
	if (mix.games.length > 10 && groups) {
		return buckets
			.map((bucket) => `${bucket.label} ${bucket.variants.length}`)
			.join(" · ");
	}
	return buckets
		.flatMap((bucket) => bucket.variants.map(shortName))
		.join(" · ");
}

export function sameGamesAs(
	gameIds: readonly string[],
	mixes: GameMix[] | undefined,
	selfId: string | null
): GameMix | null {
	const key = new Set(gameIds);
	return (
		mixes?.find(
			(mix) =>
				mix.id !== selfId &&
				mix.games.length === key.size &&
				mix.games.every((id) => key.has(id))
		) ?? null
	);
}

export function duplicateLabelError(
	rows: { archivedAt: unknown; id: string; label: string }[] | undefined,
	label: string,
	selfId: string | null,
	kind: MasterKind
): string | null {
	const key = label.trim().toLowerCase();
	const holder = rows?.find(
		(row) => row.id !== selfId && row.label.trim().toLowerCase() === key
	);
	if (!holder) {
		return null;
	}
	return isActive(holder)
		? `You already have a ${NOUNS[kind]} with this name.`
		: `An archived ${NOUNS[kind]} has this name. Restore it instead.`;
}

export function serverLabelError(
	error: unknown,
	kind: MasterKind
): string | null {
	if (trpcErrorCode(error) !== "CONFLICT" || !(error instanceof Error)) {
		return null;
	}
	if (error.message.includes("restore it instead")) {
		return `An archived ${NOUNS[kind]} has this name. Restore it instead.`;
	}
	if (error.message.includes("already have")) {
		return `You already have a ${NOUNS[kind]} with this name.`;
	}
	return null;
}
