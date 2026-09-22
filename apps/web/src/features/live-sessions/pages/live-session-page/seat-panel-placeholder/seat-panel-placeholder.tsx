import { IconUserSearch } from "@tabler/icons-react";
import { CrystEmptyState } from "../cryst-empty-state";

export function SeatPanelPlaceholder() {
	return (
		<CrystEmptyState
			className="h-full min-h-16"
			description="Tap a seated player to edit their profile here"
			icon={IconUserSearch}
			size="sm"
		/>
	);
}
