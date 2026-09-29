import { VariantPickList } from "../../variant-pick-list";
import { CrystSheet } from "../cryst-sheet";

interface MixGamesPickerSheetProps {
	isDisabled: (label: string) => boolean;
	isPicked: (label: string) => boolean;
	onOpenChange: (open: boolean) => void;
	onToggle: (label: string) => void;
	open: boolean;
}

export function MixGamesPickerSheet({
	isDisabled,
	isPicked,
	onOpenChange,
	onToggle,
	open,
}: MixGamesPickerSheetProps) {
	return (
		<CrystSheet onOpenChange={onOpenChange} open={open} title="Games in mix">
			<VariantPickList
				isDisabled={isDisabled}
				isPicked={isPicked}
				onPick={onToggle}
			/>
		</CrystSheet>
	);
}
