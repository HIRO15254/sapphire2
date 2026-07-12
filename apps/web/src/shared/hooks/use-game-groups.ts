import { MIX_VARIANT } from "@sapphire2/db/constants/game-variants";
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

interface GameMixRowLike {
	builtinKey: string | null;
	games: string[];
	id: string;
	label: string;
}

function normalizedLabel(value: string): string {
	return value.trim().toLowerCase();
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
	const mixesQuery = useQuery(trpc.gameMix.list.queryOptions());

	const groups = (groupsQuery.data ?? []) as GameGroupRowLike[];
	const variants = (variantsQuery.data ?? []) as GameVariantRowLike[];
	const mixes = (mixesQuery.data ?? []) as GameMixRowLike[];

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

	// True for the legacy mix-mode key ("mix") or any of the caller's mix
	// master labels — both freeze into the same `variant` string once picked
	// (self-freezing select), so this is the single place that recognizes
	// either shape.
	const isMixValue = (value: string): boolean => {
		const normalized = normalizedLabel(value);
		return (
			normalized === MIX_VARIANT ||
			mixes.some((mix) => normalizedLabel(mix.label) === normalized)
		);
	};

	// A mix's ordered `games` (variant ids) resolved to their current display
	// labels. Ids whose variant row no longer exists (deleted since the mix
	// was saved) are silently skipped rather than surfacing a hole in the
	// editor; an unknown mix label resolves to an empty composition.
	const mixCompositionLabels = (mixLabel: string): string[] => {
		const normalized = normalizedLabel(mixLabel);
		const mix = mixes.find((m) => normalizedLabel(m.label) === normalized);
		if (!mix) {
			return [];
		}
		const variantById = new Map(variants.map((row) => [row.id, row.label]));
		return mix.games
			.map((id) => variantById.get(id))
			.filter((label): label is string => label !== undefined);
	};

	return {
		groups,
		variants,
		mixes,
		isLoading:
			groupsQuery.isLoading || variantsQuery.isLoading || mixesQuery.isLoading,
		groupFor,
		labelsFor,
		isMixValue,
		mixCompositionLabels,
	};
}
