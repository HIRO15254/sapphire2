import { useMemo } from "react";
import type { Layout } from "react-grid-layout";
import type { Device } from "@/features/dashboard/hooks/use-current-device";
import type { DashboardWidget } from "@/features/dashboard/hooks/use-dashboard-widgets";
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

	return { layout, gridCols: GRID_COLS[device] };
}
