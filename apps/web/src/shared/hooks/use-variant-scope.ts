import {
	DEFAULT_VARIANT_LABEL,
	MIX_VARIANT,
} from "@sapphire2/db/constants/game-variants";
import { useRef } from "react";

export type VariantScope = "all" | "perLevel";

/**
 * The per-level mode is stored as the frozen legacy mix key: such a
 * tournament has no single variant — each level's games say what's played.
 */
export function scopeOf(variant: string): VariantScope {
	return variant.trim().toLowerCase() === MIX_VARIANT ? "perLevel" : "all";
}

interface UseVariantScopeArgs {
	/**
	 * Variant present when the form mounted; remembered as the switch-back
	 * target when it is an all-levels value.
	 */
	initialVariant?: string;
	/**
	 * Routed through the caller's variant-change path (form field write plus
	 * any side effects such as mix-row reseeding).
	 */
	setVariant: (variant: string) => void;
}

/**
 * All-levels vs per-level variant scope toggle shared by the tournament
 * form and the session wizard (c47). Remembers the last all-levels variant
 * so switching back from per-level restores it.
 */
export function useVariantScope({
	initialVariant,
	setVariant,
}: UseVariantScopeArgs) {
	const initial = initialVariant ?? DEFAULT_VARIANT_LABEL;
	// Last all-levels variant, restored when switching back from per-level.
	const lastAllVariant = useRef(
		scopeOf(initial) === "all" ? initial : DEFAULT_VARIANT_LABEL
	);

	const onScopeChange = (scope: VariantScope, currentVariant: string) => {
		if (scope === scopeOf(currentVariant)) {
			return;
		}
		if (scope === "perLevel") {
			lastAllVariant.current = currentVariant;
			setVariant(MIX_VARIANT);
			return;
		}
		setVariant(lastAllVariant.current || DEFAULT_VARIANT_LABEL);
	};

	return { onScopeChange, scopeOf };
}
