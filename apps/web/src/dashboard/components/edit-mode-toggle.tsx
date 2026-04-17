import { IconCheck, IconPencil } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";

interface EditModeToggleProps {
	isEditing: boolean;
	onToggle: () => void;
}

export function EditModeToggle({ isEditing, onToggle }: EditModeToggleProps) {
	return (
		<Button
			onClick={onToggle}
			size="sm"
			variant={isEditing ? "default" : "outline"}
		>
			{isEditing ? (
				<>
					<IconCheck size={14} />
					Done
				</>
			) : (
				<>
					<IconPencil size={14} />
					Edit
				</>
			)}
		</Button>
	);
}
