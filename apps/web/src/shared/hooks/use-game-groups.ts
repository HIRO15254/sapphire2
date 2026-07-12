import { useQuery } from "@tanstack/react-query";
import type { MixGroupInfo, ResolveGroup } from "@/shared/lib/mix-games";
import { trpc } from "@/utils/trpc";

/** Blind-slot labels of a group; blind3 null = no third slot. */
export interface BlindSlotLabels {
	blind1: string;
	blind2: string;
	blind3: string | null;
}

// Shown only while the master rows haven't loaded (or an account is mid-
// self-seed); the DB rows are the runtime source of truth, never constants.
const FALLBACK_LABELS: BlindSlotLabels = {
	blind1: "SB",
	blind2: "BB",
	blind3: "Straddle",
};

interface GameGroupRowLike {
	blind1Label: string | null;
	blind2Label: string | null;
	blind3Label: string | null;
	builtinKey: string | null;
	id: string;
	label: string;
}

interface GameVariantRowLike {
	builtinKey: string | null;
	groupId: string;
	id: string;
	label: string;
	shortLabel: string | null;
	sortOrder: number;
}

function toInfo(row: GameGroupRowLike, sortIndex: number): MixGroupInfo {
	return {
		id: row.id,
		label: row.label,
		blind1Label: row.blind1Label ?? "SB",
		blind2Label: row.blind2Label ?? "BB",
		blind3Label: row.blind3Label,
		sortIndex,
	};
}

/**
 * The variant/group master data (per-user DB rows, seeded at signup).
 * Bundles both lists and exposes the resolution primitives every editor
 * and form uses: variant label → owning group, builtinKey → current
 * label, and group blind-slot labels for a variant.
 */
export function useGameGroups() {
	const groupsQuery = useQuery(trpc.gameGroup.list.queryOptions());
	const variantsQuery = useQuery(trpc.gameVariant.list.queryOptions());

	const groups = (groupsQuery.data ?? []) as GameGroupRowLike[];
	const variants = (variantsQuery.data ?? []) as GameVariantRowLike[];

	// Server list order is canonical (builtin order, then customs by label).
	const infoById = new Map<string, MixGroupInfo>(
		groups.map((g, index) => [g.id, toInfo(g, index)])
	);

	const variantByLabel = (label: string): GameVariantRowLike | undefined => {
		const normalized = label.trim().toLowerCase();
		return variants.find(
			(row) => row.label.trim().toLowerCase() === normalized
		);
	};

	const fallbackGroup = (): MixGroupInfo => {
		const bigbet =
			groups.find((g) => g.builtinKey === "bigbet") ?? groups.at(0);
		const info = bigbet ? infoById.get(bigbet.id) : undefined;
		return (
			info ?? {
				id: "__pending__",
				label: "Big Bet",
				blind1Label: FALLBACK_LABELS.blind1,
				blind2Label: FALLBACK_LABELS.blind2,
				blind3Label: FALLBACK_LABELS.blind3,
				sortIndex: groups.length,
			}
		);
	};

	const groupFor: ResolveGroup = (variantLabel) => {
		const row = variantByLabel(variantLabel);
		const info = row ? infoById.get(row.groupId) : undefined;
		return info ?? fallbackGroup();
	};

	const resolveVariantLabel = (builtinKey: string): string | null =>
		variants.find((row) => row.builtinKey === builtinKey)?.label ?? null;

	const labelsFor = (variantLabel: string): BlindSlotLabels => {
		const row = variantByLabel(variantLabel);
		const info = row ? infoById.get(row.groupId) : undefined;
		if (!info) {
			return FALLBACK_LABELS;
		}
		return {
			blind1: info.blind1Label,
			blind2: info.blind2Label,
			blind3: info.blind3Label,
		};
	};

	return {
		groups,
		variants,
		isLoading: groupsQuery.isLoading || variantsQuery.isLoading,
		groupFor,
		resolveVariantLabel,
		labelsFor,
	};
}
