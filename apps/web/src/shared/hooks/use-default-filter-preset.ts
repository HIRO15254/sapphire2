import { useEffect, useRef } from "react";
import type { FilterPresetScreenKey } from "@/shared/hooks/use-filter-presets";
import { useFilterPresets } from "@/shared/hooks/use-filter-presets";

export function useDefaultFilterPreset<TPayload>(
	screenKey: FilterPresetScreenKey,
	isUntouched: boolean,
	applyDefault: (payload: TPayload) => void
): void {
	const { defaultPreset, isSuccess } = useFilterPresets(screenKey);
	const hasAttemptedRef = useRef(false);

	useEffect(() => {
		if (hasAttemptedRef.current || !isSuccess) {
			return;
		}
		hasAttemptedRef.current = true;
		if (isUntouched && defaultPreset) {
			applyDefault(defaultPreset.payload as TPayload);
		}
	}, [isSuccess, isUntouched, defaultPreset, applyDefault]);
}
