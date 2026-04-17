import type { WidgetType } from "@/dashboard/hooks/use-dashboard-widgets";
import { getWidgetEntry } from "@/dashboard/widgets/registry";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

interface WidgetEditDialogProps {
	config: Record<string, unknown>;
	onOpenChange: (open: boolean) => void;
	onSave: (nextConfig: Record<string, unknown>) => Promise<unknown> | undefined;
	open: boolean;
	type: WidgetType;
	widgetId: string;
}

export function WidgetEditDialog({
	open,
	onOpenChange,
	widgetId,
	type,
	config,
	onSave,
}: WidgetEditDialogProps) {
	const entry = getWidgetEntry(type);
	const EditForm = entry?.EditForm;
	const title = entry?.label ?? "Edit Widget";

	return (
		<ResponsiveDialog
			description="Update widget settings"
			onOpenChange={onOpenChange}
			open={open}
			title={`Edit ${title}`}
		>
			{EditForm ? (
				<EditForm
					config={config}
					onCancel={() => onOpenChange(false)}
					onSave={async (next) => {
						await onSave(next);
						onOpenChange(false);
					}}
					widgetId={widgetId}
				/>
			) : (
				<div className="p-4 text-muted-foreground text-sm">
					This widget has no configurable settings.
				</div>
			)}
		</ResponsiveDialog>
	);
}
