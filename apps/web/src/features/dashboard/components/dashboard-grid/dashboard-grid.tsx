import "react-grid-layout/css/styles.css";
import "./dashboard-grid.css";
import GridLayout, { type Layout } from "react-grid-layout";
import {
	DashboardWidget,
	WIDGET_DRAG_HANDLE_CLASS,
} from "@/features/dashboard/components/dashboard-widget";
import { WidgetRenderer } from "@/features/dashboard/components/widget-renderer";
import type { Device } from "@/features/dashboard/hooks/use-current-device";
import type { DashboardWidget as DashboardWidgetRow } from "@/features/dashboard/hooks/use-dashboard-widgets";
import { GlobalFilterProvider } from "@/features/dashboard/hooks/use-global-filter";
import { GRID_COLS, useDashboardGrid } from "./use-dashboard-grid";

const ROW_HEIGHT = 40;

export interface DashboardGridProps {
	containerWidth: number;
	device: Device;
	isEditing: boolean;
	onDeleteWidget?: (widget: DashboardWidgetRow) => void;
	onEditWidget?: (widget: DashboardWidgetRow) => void;
	onLayoutChange?: (layout: Layout[]) => void;
	widgets: DashboardWidgetRow[];
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
	const { layout, globalFilter } = useDashboardGrid(widgets, device);

	return (
		<GlobalFilterProvider value={globalFilter}>
			<GridLayout
				cols={GRID_COLS[device]}
				containerPadding={[0, 0]}
				draggableHandle={`.${WIDGET_DRAG_HANDLE_CLASS}`}
				isDraggable={isEditing}
				isResizable={isEditing}
				layout={layout}
				margin={[8, 8]}
				onDragStop={(current) => onLayoutChange?.(current)}
				onResizeStop={(current) => onLayoutChange?.(current)}
				rowHeight={ROW_HEIGHT}
				width={containerWidth}
			>
				{widgets.map((widget) => (
					<div key={widget.id}>
						<DashboardWidget
							id={widget.id}
							isEditing={isEditing}
							onDelete={
								onDeleteWidget ? () => onDeleteWidget(widget) : undefined
							}
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
		</GlobalFilterProvider>
	);
}
