import "react-grid-layout/css/styles.css";
import "./dashboard-grid.css";
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

/**
 * Swap semantics:
 * - Start from the layout as it was when drag began (dragStartLayoutRef).
 * - The dragged widget lands at its new (x, y).
 * - If its new bounds fully contain another widget's center, we swap them:
 *   that widget moves to the dragged widget's original position.
 * - Everyone else stays exactly where they were.
 */
function computeSwapLayout(
	original: Layout[],
	draggedId: string,
	draggedNew: { x: number; y: number; w: number; h: number }
): Layout[] {
	const draggedOriginal = original.find((item) => item.i === draggedId);
	if (!draggedOriginal) {
		return original;
	}

	const containsCenter = (
		candidate: Layout,
		box: { x: number; y: number; w: number; h: number }
	) => {
		const cx = candidate.x + candidate.w / 2;
		const cy = candidate.y + candidate.h / 2;
		return (
			cx >= box.x && cx < box.x + box.w && cy >= box.y && cy < box.y + box.h
		);
	};

	const swapTarget = original.find(
		(item) => item.i !== draggedId && containsCenter(item, draggedNew)
	);

	return original.map((item) => {
		if (item.i === draggedId) {
			return { ...item, ...draggedNew };
		}
		if (swapTarget && item.i === swapTarget.i) {
			return {
				...item,
				x: draggedOriginal.x,
				y: draggedOriginal.y,
			};
		}
		return item;
	});
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
	const dragStartLayoutRef = useRef<Layout[] | null>(null);
	const layout = useMemo(
		() => widgets.map((w) => toLayoutItem(w, device)),
		[widgets, device]
	);

	return (
		<GridLayout
			allowOverlap
			cols={GRID_COLS[device]}
			compactType={null}
			draggableHandle={`.${WIDGET_DRAG_HANDLE_CLASS}`}
			isDraggable={isEditing}
			isResizable={isEditing}
			layout={layout}
			margin={[8, 8]}
			onDragStart={(current) => {
				dragStartLayoutRef.current = current.map((item) => ({ ...item }));
			}}
			onDragStop={(_current, _oldItem, newItem) => {
				const original = dragStartLayoutRef.current ?? layout;
				const next = computeSwapLayout(original, newItem.i, {
					x: newItem.x,
					y: newItem.y,
					w: newItem.w,
					h: newItem.h,
				});
				dragStartLayoutRef.current = null;
				onLayoutChange?.(next);
			}}
			onResizeStop={(current) => onLayoutChange?.(current)}
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
