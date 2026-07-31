import { IconBookmark } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";

interface FilterPresetsChipProps {
	onClick: () => void;
}

/**
 * Trigger chip that opens the Presets bottom sheet. Styled to match
 * `FilterChip`'s look-and-feel (outlined, `size="sm"`) without depending on
 * it — this chip has no `active`/`invalid` state of its own.
 */
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
