import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layout } from "react-grid-layout";
import type { Device } from "@/features/dashboard/hooks/use-current-device";
import type { DashboardWidget } from "@/features/dashboard/hooks/use-dashboard-widgets";
import {
	configToInitialValues,
	type GlobalFilterKey,
	type GlobalFilterValues,
	resolveGlobalFilterFromWidgets,
} from "@/features/dashboard/hooks/use-global-filter";
import { getWidgetEntry } from "@/features/dashboard/widgets/registry";

export const GRID_COLS: Record<Device, number> = {
	mobile: 6,
	desktop: 12,
};

export function toLayoutItem(widget: DashboardWidget, device: Device): Layout {
	const entry = getWidgetEntry(widget.type);
	const minSize = entry?.minSize ?? { w: 2, h: 2 };
	return {
		i: widget.id,
		x: widget.x,
		y: widget.y,
		w: widget.w,
		h: widget.h,
		minW: minSize.w,
		minH: minSize.h,
		maxW: GRID_COLS[device],
	};
}

export function useDashboardGrid(widgets: DashboardWidget[], device: Device) {
	const layout = useMemo(
		() => widgets.map((w) => toLayoutItem(w, device)),
		[widgets, device]
	);

	const fieldsConfig = useMemo(
		() => resolveGlobalFilterFromWidgets(widgets),
		[widgets]
	);
	const initialValues = useMemo<GlobalFilterValues>(
		() => configToInitialValues(fieldsConfig),
		[fieldsConfig]
	);

	const [values, setValues] = useState<GlobalFilterValues>(initialValues);
	const initialValuesKey = JSON.stringify(initialValues);
	const lastInitialKey = useRef(initialValuesKey);
	useEffect(() => {
		if (lastInitialKey.current !== initialValuesKey) {
			lastInitialKey.current = initialValuesKey;
			setValues(initialValues);
		}
	}, [initialValuesKey, initialValues]);

	const setValue = useCallback(
		<K extends GlobalFilterKey>(key: K, value: GlobalFilterValues[K]) => {
			setValues((prev) => ({ ...prev, [key]: value }));
		},
		[]
	);

	const reset = useCallback(() => {
		setValues(initialValues);
	}, [initialValues]);

	const globalFilter = useMemo(
		() => ({ values, setValue, reset }),
		[values, setValue, reset]
	);

	return {
		layout,
		gridCols: GRID_COLS[device],
		globalFilter,
	};
}
