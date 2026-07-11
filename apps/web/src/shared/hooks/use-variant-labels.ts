import {
	type BlindLabels,
	resolveBlindLabels,
} from "@sapphire2/db/constants/game-variants";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

/**
 * Blind-slot labels for a variant, custom-variant aware: preset keys resolve
 * to their preset labels, anything else is looked up (case-insensitively) in
 * the user's custom variant definitions, falling back to SB/BB/Straddle for
 * unknown values (e.g. a deleted custom variant frozen into an old session).
 */
export function useVariantLabels(variant: string): BlindLabels {
	const customVariantsQuery = useQuery(trpc.gameVariant.list.queryOptions());
	const normalized = variant.trim().toLowerCase();
	const custom = (customVariantsQuery.data ?? []).find(
		(row) => row.label.trim().toLowerCase() === normalized
	);
	return resolveBlindLabels(variant, custom ?? null);
}
