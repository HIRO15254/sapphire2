import {
	DEFAULT_VARIANT_LABEL,
	MIX_VARIANT,
} from "@sapphire2/db/constants/game-variants";
import { useRef } from "react";

export type VariantScope = "all" | "perLevel";

export function scopeOf(variant: string): VariantScope {
	return variant.trim().toLowerCase() === MIX_VARIANT ? "perLevel" : "all";
}

interface UseVariantScopeArgs {
	initialVariant?: string;
	setVariant: (variant: string) => void;
}

export function useVariantScope({
	initialVariant,
	setVariant,
}: UseVariantScopeArgs) {
	const initial = initialVariant ?? DEFAULT_VARIANT_LABEL;
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
