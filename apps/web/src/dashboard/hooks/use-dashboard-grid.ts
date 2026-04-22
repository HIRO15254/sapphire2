import { useMemo } from "react";
import type { Layout } from "react-grid-layout";
import type { Device } from "@/dashboard/hooks/use-current-device";
import type { DashboardWidget } from "@/dashboard/hooks/use-dashboard-widgets";
import { getWidgetEntry } from "@/dashboard/widgets/registry";

export const GRID_COLS: Record<Device, number> = {
	mobile: 4,
	desktop: 12,
};

export function toLayoutItem(widget: DashboardWidget, device: Device): Layout {
	const entry = getWidgetEntry(widget.type);
	const minSize = entry?.minSize ?? { w: 2, h: 1 };
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
