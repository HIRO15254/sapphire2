import type { WidgetType } from "@/features/dashboard/hooks/use-dashboard-widgets";
import { getWidgetEntry } from "@/features/dashboard/widgets/registry";
import { FormSheet } from "@/shared/components/form-sheet";

const WIDGET_EDIT_FORM_ID = "widget-edit-form";

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
	const title = entry?.label ?? "Widget";

	return (
		<FormSheet
			formId={WIDGET_EDIT_FORM_ID}
			onOpenChange={onOpenChange}
			open={open}
			title={`Edit ${title}`}
		>
			{EditForm ? (
				<EditForm
					config={config}
					formId={WIDGET_EDIT_FORM_ID}
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
		</FormSheet>
	);
}
