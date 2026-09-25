import { VariantPickList } from "../../variant-pick-list";
import { CrystSheet } from "../cryst-sheet";

interface GroupGamesSheetProps {
	hint: string;
	isDisabled: (label: string) => boolean;
	isPicked: (label: string) => boolean;
	onOpenChange: (open: boolean) => void;
	onToggle: (label: string) => void;
	open: boolean;
}

export function GroupGamesSheet({
	hint,
	isDisabled,
	isPicked,
	onOpenChange,
	onToggle,
	open,
}: GroupGamesSheetProps) {
	return (
		<CrystSheet
			onOpenChange={onOpenChange}
			open={open}
			title="Add games to group"
		>
			<div className="flex flex-col gap-2.5">
				<VariantPickList
					isDisabled={isDisabled}
					isPicked={isPicked}
					onPick={onToggle}
				/>
				<p className="text-pretty text-[length:var(--m-text-caption)] text-muted-foreground leading-[var(--m-leading-body)]">
					{hint}
				</p>
			</div>
		</CrystSheet>
	);
}
