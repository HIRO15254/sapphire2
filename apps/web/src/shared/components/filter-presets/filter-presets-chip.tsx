import { IconBookmark } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";

interface FilterPresetsChipProps {
	onClick: () => void;
}

export function FilterPresetsChip({ onClick }: FilterPresetsChipProps) {
	return (
		<Button
			className="shrink-0 gap-1.5"
			onClick={onClick}
			size="sm"
			type="button"
			variant="outline"
		>
			<IconBookmark size={14} />
			Presets
		</Button>
	);
}
