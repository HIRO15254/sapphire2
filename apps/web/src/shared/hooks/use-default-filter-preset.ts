import { useEffect, useRef } from "react";
import type { FilterPresetScreenKey } from "@/shared/hooks/use-filter-presets";
import { useFilterPresets } from "@/shared/hooks/use-filter-presets";

/**
 * Auto-applies a screen's default filter preset on first load. Side-effect
 * only — it returns nothing and owns no state; the caller keeps its own filter
 * state and just receives the stored payload.
 *
 * Shared by the sessions list and the statistics screen, which had identical
 * copies of this effect. The two screens differ only in how they decide the
 * filters are still pristine (local state emptiness vs. a genuinely bare URL),
 * so that decision stays with the caller as `isUntouched`.
 *
 * The `useRef` guard makes this a ONE-SHOT *attempt*: the flag is set as soon
 * as the presets query resolves, whether or not a preset was applied. A default
 * preset that appears later (a refetch, another tab, the user marking one while
 * on the page) must never re-fire and clobber filters the user has since set.
 *
 * @param screenKey Which screen's presets to read.
 * @param isUntouched Caller's verdict on whether the filters are still
 *   untouched; the apply is skipped when false so a deep link / explicit
 *   filter always wins.
 * @param applyDefault Called at most once with the default preset's stored
 *   payload. The payload is stored JSON, so it is cast to the caller's shape —
 *   callers must tolerate values their current code no longer understands.
 */
export function useDefaultFilterPreset<TPayload>(
	screenKey: FilterPresetScreenKey,
	isUntouched: boolean,
	applyDefault: (payload: TPayload) => void
): void {
	const { defaultPreset, isLoading } = useFilterPresets(screenKey);
	const hasAttemptedRef = useRef(false);

	useEffect(() => {
		if (hasAttemptedRef.current || isLoading) {
			return;
		}
		hasAttemptedRef.current = true;
		if (isUntouched && defaultPreset) {
			applyDefault(defaultPreset.payload as TPayload);
		}
	}, [isLoading, isUntouched, defaultPreset, applyDefault]);
}
