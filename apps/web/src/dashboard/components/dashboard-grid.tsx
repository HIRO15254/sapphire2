import "react-grid-layout/css/styles.css";
import { useMemo, useRef } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import {
	DashboardWidget,
	WIDGET_DRAG_HANDLE_CLASS,
} from "@/dashboard/components/dashboard-widget";
import { WidgetRenderer } from "@/dashboard/components/widget-renderer";
import type { Device } from "@/dashboard/hooks/use-current-device";
import type { DashboardWidget as DashboardWidgetRow } from "@/dashboard/hooks/use-dashboard-widgets";
import { getWidgetEntry } from "@/dashboard/widgets/registry";

const GRID_COLS: Record<Device, number> = {
	mobile: 4,
	desktop: 12,
};

const ROW_HEIGHT = 80;

export interface DashboardGridProps {
	containerWidth: number;
	device: Device;
	isEditing: boolean;
	onDeleteWidget?: (widget: DashboardWidgetRow) => void;
	onEditWidget?: (widget: DashboardWidgetRow) => void;
	onLayoutChange?: (layout: Layout[]) => void;
	widgets: DashboardWidgetRow[];
}

function toLayoutItem(widget: DashboardWidgetRow, device: Device): Layout {
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

export function DashboardGrid({
	device,
	widgets,
	isEditing,
	containerWidth,
	onLayoutChange,
	onEditWidget,
	onDeleteWidget,
}: DashboardGridProps) {
	const layoutsRef = useRef<Layout[]>([]);
	const layout = useMemo(
		() => widgets.map((w) => toLayoutItem(w, device)),
		[widgets, device]
	);
	layoutsRef.current = layout;

	return (
		<GridLayout
			cols={GRID_COLS[device]}
			compactType={null}
			draggableHandle={`.${WIDGET_DRAG_HANDLE_CLASS}`}
			isDraggable={isEditing}
			isResizable={isEditing}
			layout={layout}
			margin={[8, 8]}
			onDragStop={(_layout) => onLayoutChange?.(_layout)}
			onResizeStop={(_layout) => onLayoutChange?.(_layout)}
			preventCollision
			rowHeight={ROW_HEIGHT}
			width={containerWidth}
		>
			{widgets.map((widget) => (
				<div key={widget.id}>
					<DashboardWidget
						id={widget.id}
						isEditing={isEditing}
						onDelete={onDeleteWidget ? () => onDeleteWidget(widget) : undefined}
						onEdit={onEditWidget ? () => onEditWidget(widget) : undefined}
						type={widget.type}
					>
						<WidgetRenderer
							config={widget.config}
							type={widget.type}
							widgetId={widget.id}
						/>
					</DashboardWidget>
				</div>
			))}
		</GridLayout>
	);
}
