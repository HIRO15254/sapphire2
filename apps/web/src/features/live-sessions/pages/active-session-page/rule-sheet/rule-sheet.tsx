import { ActiveSessionGameScene } from "@/features/live-sessions/components/active-session-game-scene";
import { BottomSheet } from "@/shared/components/bottom-sheet";

export interface RuleSheetProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function RuleSheet({ onOpenChange, open }: RuleSheetProps) {
	return (
		<BottomSheet
			cancelLabel="Close"
			onOpenChange={onOpenChange}
			open={open}
			title="Session"
		>
			{open ? <ActiveSessionGameScene /> : null}
		</BottomSheet>
	);
}
