import type { useSortable } from "@dnd-kit/sortable";
import { IconGripVertical } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";

interface DragHandleProps {
	attributes: ReturnType<typeof useSortable>["attributes"];
	listeners: ReturnType<typeof useSortable>["listeners"];
}

export function DragHandle({ attributes, listeners }: DragHandleProps) {
	return (
		<Button
			aria-label="Drag to reorder"
			className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
			size="icon-xs"
			type="button"
			variant="ghost"
			{...attributes}
			{...listeners}
		>
			<IconGripVertical size={14} />
		</Button>
	);
}
