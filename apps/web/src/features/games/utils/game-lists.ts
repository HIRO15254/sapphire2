import type {
	GameGroup,
	GameMix,
	GameVariant,
} from "../hooks/use-game-masters";
import {
	archiveGroupBlock,
	archiveVariantBlock,
	blindSummary,
	countLabel,
	isActive,
	type MasterKind,
	mixSummary,
	restoreMixBlock,
	restoreVariantBlock,
} from "./game-masters";

export interface MasterData {
	groups: GameGroup[] | undefined;
	mixes: GameMix[] | undefined;
	variants: GameVariant[] | undefined;
}

export interface MasterRef {
	id: string;
	kind: MasterKind;
}

export type Master = GameGroup | GameMix | GameVariant;

export function findMaster(
	data: MasterData,
	ref: MasterRef | null
): Master | undefined {
	if (!ref) {
		return;
	}
	const rows: Master[] | undefined = {
		group: data.groups,
		mix: data.mixes,
		variant: data.variants,
	}[ref.kind];
	return rows?.find((row) => row.id === ref.id);
}

export function blockedReason(data: MasterData, ref: MasterRef): string | null {
	const item = findMaster(data, ref);
	if (!item) {
		return null;
	}
	if (isActive(item)) {
		if (ref.kind === "variant") {
			return archiveVariantBlock(ref.id, data.mixes);
		}
		return ref.kind === "group"
			? archiveGroupBlock(ref.id, data.variants)
			: null;
	}
	if (ref.kind === "variant") {
		return restoreVariantBlock(item as GameVariant, data.groups);
	}
	return ref.kind === "mix"
		? restoreMixBlock(item as GameMix, data.variants)
		: null;
}

function variantRow(variant: GameVariant) {
	return {
		archived: !isActive(variant),
		id: variant.id,
		label: variant.label,
		short: variant.shortLabel ?? "",
	};
}

export function variantSections(
	groups: GameGroup[] | undefined,
	variants: GameVariant[]
) {
	const active = variants.filter(isActive);
	const owners = groups
		? groups.filter(isActive).map((group) => ({
				aside: blindSummary(group),
				id: group.id,
				rows: active
					.filter((variant) => variant.groupId === group.id)
					.map(variantRow),
				title: group.label,
			}))
		: [
				{
					aside: "",
					id: "all",
					rows: active.map(variantRow),
					title: "All games",
				},
			];
	return [
		...owners,
		{
			aside: "",
			id: "archived",
			rows: variants.filter((row) => !isActive(row)).map(variantRow),
			title: "Archived",
		},
	].filter((section) => section.rows.length > 0);
}

export function mixRows(data: MasterData) {
	const row = (mix: GameMix) => ({
		count: countLabel(mix.games.length, "game"),
		id: mix.id,
		label: mix.label,
		summary: mixSummary(mix, data.variants, data.groups),
	});
	const mixes = data.mixes ?? [];
	return {
		active: mixes.filter(isActive).map(row),
		archived: mixes.filter((mix) => !isActive(mix)).map(row),
	};
}

export function groupRows(data: MasterData) {
	const activeVariants = data.variants?.filter(isActive);
	const row = (group: GameGroup) => ({
		count: activeVariants
			? countLabel(
					activeVariants.filter((variant) => variant.groupId === group.id)
						.length,
					"game"
				)
			: "",
		id: group.id,
		label: group.label,
		summary: blindSummary(group, true),
	});
	const groups = data.groups ?? [];
	return {
		active: groups.filter(isActive).map(row),
		archived: groups.filter((group) => !isActive(group)).map(row),
	};
}
