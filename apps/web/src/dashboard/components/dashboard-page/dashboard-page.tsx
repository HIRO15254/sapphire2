import type { Layout } from "react-grid-layout";
import { AddWidgetMenu } from "@/dashboard/components/add-widget-menu";
import { DashboardGrid } from "@/dashboard/components/dashboard-grid";
import { EditModeToggle } from "@/dashboard/components/edit-mode-toggle";
import { WidgetEditDialog } from "@/dashboard/components/widget-edit-dialog";
import type { Device } from "@/dashboard/hooks/use-current-device";
import type {
	DashboardWidget,
	WidgetType,
} from "@/dashboard/hooks/use-dashboard-widgets";
import { useDashboardPage } from "@/routes/-use-dashboard-page";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface DashboardContentProps {
	containerWidth: number;
	device: Device;
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
	const {
		blocker,
		containerRef,
		containerWidth,
		deletingWidget,
		device,
		editingWidget,
		error,
		handleAdd,
		handleBlockerCancel,
		handleBlockerDiscard,
		handleBlockerSave,
		handleDelete,
		handleDeletingWidgetDialogChange,
		handleDoneClick,
		handleEditingWidgetDialogChange,
		handleEditSave,
		handleLayoutChange,
		isEditing,
		isLoading,
		setDeletingWidget,
		setEditingWidget,
		widgets,
	} = useDashboardPage();

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
					onOpenChange={handleEditingWidgetDialogChange}
					onSave={handleEditSave}
					open
					type={editingWidget.type}
					widgetId={editingWidget.id}
				/>
			) : null}

			<ResponsiveDialog
				onOpenChange={handleDeletingWidgetDialogChange}
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
					<Button onClick={handleBlockerCancel} variant="outline">
						Cancel
					</Button>
					<Button onClick={handleBlockerDiscard} variant="destructive">
						Discard
					</Button>
					<Button onClick={handleBlockerSave}>Save &amp; continue</Button>
				</DialogActionRow>
			</ResponsiveDialog>
		</div>
	);
}
