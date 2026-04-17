import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout } from "react-grid-layout";
import { AddWidgetMenu } from "@/dashboard/components/add-widget-menu";
import { DashboardGrid } from "@/dashboard/components/dashboard-grid";
import { EditModeToggle } from "@/dashboard/components/edit-mode-toggle";
import { WidgetEditDialog } from "@/dashboard/components/widget-edit-dialog";
import { useCurrentDevice } from "@/dashboard/hooks/use-current-device";
import {
	type DashboardWidget,
	useDashboardWidgets,
	type WidgetType,
} from "@/dashboard/hooks/use-dashboard-widgets";
import { useEditMode } from "@/dashboard/hooks/use-edit-mode";
import {
	type LayoutItem,
	useLayoutSync,
} from "@/dashboard/hooks/use-layout-sync";
import { PageHeader } from "@/shared/components/page-header";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";

function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
	const ref = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) {
			return;
		}
		const update = () => setWidth(el.getBoundingClientRect().width);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return [ref, width];
}

function layoutsToItems(layout: Layout[]): LayoutItem[] {
	return layout.map((l) => ({
		id: l.i,
		x: l.x,
		y: l.y,
		w: l.w,
		h: l.h,
	}));
}

interface DashboardContentProps {
	containerWidth: number;
	device: ReturnType<typeof useCurrentDevice>;
	isEditing: boolean;
	isEmpty: boolean;
	isLoading: boolean;
	onAdd: (type: WidgetType) => void;
	onDeleteWidget: (widget: DashboardWidget) => void;
	onEditWidget: (widget: DashboardWidget) => void;
	onLayoutChange: (layout: Layout[]) => void;
	widgets: DashboardWidget[];
}

function renderContent(props: DashboardContentProps) {
	if (props.isLoading) {
		return (
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				<Skeleton className="h-40" />
				<Skeleton className="h-40" />
				<Skeleton className="h-40" />
			</div>
		);
	}
	if (props.isEmpty) {
		return (
			<EmptyState
				action={<AddWidgetMenu onSelect={props.onAdd} />}
				description="Add widgets to start customizing your dashboard"
				heading="No widgets yet"
			/>
		);
	}
	return (
		<DashboardGrid
			containerWidth={props.containerWidth}
			device={props.device}
			isEditing={props.isEditing}
			onDeleteWidget={props.onDeleteWidget}
			onEditWidget={props.onEditWidget}
			onLayoutChange={props.onLayoutChange}
			widgets={props.widgets}
		/>
	);
}

export function DashboardPage() {
	const device = useCurrentDevice();
	const {
		widgets,
		isLoading,
		error,
		createWidget,
		updateWidget,
		deleteWidget,
	} = useDashboardWidgets(device);
	const { isEditing, toggle } = useEditMode();
	const { enqueue, flush } = useLayoutSync(device);
	const [containerRef, containerWidth] = useContainerWidth();
	const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(
		null
	);
	const [deletingWidget, setDeletingWidget] = useState<DashboardWidget | null>(
		null
	);

	useEffect(() => {
		if (!isEditing) {
			flush();
		}
	}, [isEditing, flush]);

	const handleLayoutChange = useCallback(
		(layout: Layout[]) => {
			enqueue(layoutsToItems(layout));
		},
		[enqueue]
	);

	const handleAdd = useCallback(
		async (type: WidgetType) => {
			await createWidget({ type });
		},
		[createWidget]
	);

	const handleEditSave = useCallback(
		async (nextConfig: Record<string, unknown>) => {
			if (!editingWidget) {
				return;
			}
			await updateWidget({ id: editingWidget.id, config: nextConfig });
		},
		[editingWidget, updateWidget]
	);

	const handleDelete = useCallback(async () => {
		if (!deletingWidget) {
			return;
		}
		await deleteWidget(deletingWidget.id);
		setDeletingWidget(null);
	}, [deletingWidget, deleteWidget]);

	return (
		<div className="container mx-auto max-w-7xl px-4 py-4">
			<PageHeader
				actions={
					<div className="flex items-center gap-2">
						{isEditing ? <AddWidgetMenu onSelect={handleAdd} /> : null}
						<EditModeToggle isEditing={isEditing} onToggle={toggle} />
					</div>
				}
				description="Customize your dashboard with widgets"
				heading="Dashboard"
			/>

			{error ? (
				<Alert className="mb-4" variant="destructive">
					<AlertDescription>
						Failed to load dashboard: {error.message}
					</AlertDescription>
				</Alert>
			) : null}

			<div ref={containerRef}>
				{renderContent({
					isLoading: isLoading || containerWidth === 0,
					isEmpty: widgets.length === 0,
					containerWidth,
					device,
					isEditing,
					widgets,
					onLayoutChange: handleLayoutChange,
					onEditWidget: setEditingWidget,
					onDeleteWidget: setDeletingWidget,
					onAdd: handleAdd,
				})}
			</div>

			{editingWidget ? (
				<WidgetEditDialog
					config={editingWidget.config}
					onOpenChange={(open) => {
						if (!open) {
							setEditingWidget(null);
						}
					}}
					onSave={handleEditSave}
					open
					type={editingWidget.type}
					widgetId={editingWidget.id}
				/>
			) : null}

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setDeletingWidget(null);
					}
				}}
				open={deletingWidget !== null}
				title="Delete widget"
			>
				{deletingWidget ? (
					<div className="flex flex-col gap-4">
						<p className="text-sm">
							Are you sure you want to delete this widget? This action cannot be
							undone.
						</p>
						<DialogActionRow>
							<Button onClick={() => setDeletingWidget(null)} variant="outline">
								Cancel
							</Button>
							<Button onClick={handleDelete} variant="destructive">
								Delete
							</Button>
						</DialogActionRow>
					</div>
				) : null}
			</ResponsiveDialog>
		</div>
	);
}
