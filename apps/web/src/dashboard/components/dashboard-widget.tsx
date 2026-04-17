import { IconEdit, IconGripVertical, IconTrash } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { WidgetType } from "@/dashboard/hooks/use-dashboard-widgets";
import { getWidgetEntry } from "@/dashboard/widgets/registry";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";

export const WIDGET_DRAG_HANDLE_CLASS = "dashboard-widget-drag-handle";

interface DashboardWidgetProps {
	children: ReactNode;
	id: string;
	isEditing: boolean;
	onDelete?: () => void;
	onEdit?: () => void;
	type: WidgetType;
}

export function DashboardWidget({
	id: _id,
	type,
	isEditing,
	onEdit,
	onDelete,
	children,
}: DashboardWidgetProps) {
	const entry = getWidgetEntry(type);
	const label = entry?.label ?? type;
	const Icon = entry?.icon;

	return (
		<div
			className={cn(
				"relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
				isEditing && "ring-1 ring-primary/40"
			)}
		>
			<div className="flex h-[26px] items-center justify-between gap-2 border-b bg-muted/30 px-2">
				<div className="flex min-w-0 items-center gap-1 text-muted-foreground">
					{isEditing ? (
						<button
							aria-label={`Drag ${label}`}
							className={cn(
								WIDGET_DRAG_HANDLE_CLASS,
								"shrink-0 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
							)}
							type="button"
						>
							<IconGripVertical size={14} />
						</button>
					) : null}
					{Icon ? <Icon className="shrink-0" size={14} /> : null}
					<span className="truncate font-medium text-xs">{label}</span>
				</div>
				{isEditing ? (
					<div className="flex shrink-0 gap-1">
						{onEdit ? (
							<Button
								aria-label={`Edit ${label}`}
								onClick={onEdit}
								size="icon-xs"
								variant="ghost"
							>
								<IconEdit size={12} />
							</Button>
						) : null}
						{onDelete ? (
							<Button
								aria-label={`Delete ${label}`}
								onClick={onDelete}
								size="icon-xs"
								variant="ghost"
							>
								<IconTrash size={12} />
							</Button>
						) : null}
					</div>
				) : null}
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
		</div>
	);
}
