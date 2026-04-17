import { useBlocker } from "@tanstack/react-router";
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
	const { isEditing, setEditing, toggle } = useEditMode();
	const { enqueue, flush, discard, hasPendingChanges } = useLayoutSync(device);
	const [containerRef, containerWidth] = useContainerWidth();
	const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(
		null
	);
	const [deletingWidget, setDeletingWidget] = useState<DashboardWidget | null>(
		null
	);

	const blocker = useBlocker({
		shouldBlockFn: () => hasPendingChanges,
		enableBeforeUnload: () => hasPendingChanges,
		withResolver: true,
	});

	const handleLayoutChange = useCallback(
		(layout: Layout[]) => {
			enqueue(layoutsToItems(layout));
		},
		[enqueue]
	);

	const handleDoneClick = useCallback(async () => {
		if (isEditing) {
			await flush();
			setEditing(false);
		} else {
			toggle();
		}
	}, [isEditing, flush, setEditing, toggle]);

	const handleAdd = useCallback(
		async (type: WidgetType) => {
			await flush();
			await createWidget({ type });
		},
		[createWidget, flush]
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
		await flush();
		await deleteWidget(deletingWidget.id);
		setDeletingWidget(null);
	}, [deletingWidget, deleteWidget, flush]);

	const handleBlockerSave = useCallback(async () => {
		if (blocker.status !== "blocked") {
			return;
		}
		await flush();
		blocker.proceed();
	}, [blocker, flush]);

	const handleBlockerDiscard = useCallback(() => {
		if (blocker.status !== "blocked") {
			return;
		}
		discard();
		blocker.proceed();
	}, [blocker, discard]);

	return (
		<div className="p-4 md:p-6">
			<div className="mb-6 flex items-center justify-between gap-3">
				<h1 className="font-bold text-2xl">Dashboard</h1>
				<div className="flex items-center gap-2">
					{isEditing ? <AddWidgetMenu onSelect={handleAdd} /> : null}
					<EditModeToggle isEditing={isEditing} onToggle={handleDoneClick} />
				</div>
			</div>

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

			<ResponsiveDialog
				description="You have unsaved layout changes. Save before leaving?"
				onOpenChange={(open) => {
					if (!open && blocker.status === "blocked") {
						blocker.reset();
					}
				}}
				open={blocker.status === "blocked"}
				title="Unsaved changes"
			>
				<DialogActionRow>
					<Button
						onClick={() =>
							blocker.status === "blocked" ? blocker.reset() : undefined
						}
						variant="outline"
					>
						Cancel
					</Button>
					<Button onClick={handleBlockerDiscard} variant="destructive">
						Discard
					</Button>
					<Button onClick={handleBlockerSave}>Save & continue</Button>
				</DialogActionRow>
			</ResponsiveDialog>
		</div>
	);
}
