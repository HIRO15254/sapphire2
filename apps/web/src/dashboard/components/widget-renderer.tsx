import type { WidgetType } from "@/dashboard/hooks/use-dashboard-widgets";
import { getWidgetEntry } from "@/dashboard/widgets/registry";

interface WidgetRendererProps {
	config: Record<string, unknown>;
	type: WidgetType;
	widgetId: string;
}

export function WidgetRenderer({
	widgetId,
	type,
	config,
}: WidgetRendererProps) {
	const entry = getWidgetEntry(type);
	if (!entry) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
				Unknown widget type: {type}
			</div>
		);
	}
	const Render = entry.Render;
	return <Render config={config} widgetId={widgetId} />;
}
