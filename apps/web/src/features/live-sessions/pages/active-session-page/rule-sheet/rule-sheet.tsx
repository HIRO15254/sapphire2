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
			{open ? (
				<div className="flex flex-col gap-3">
					<ActiveSessionGameScene />
					<p className="text-pretty text-muted-foreground text-xs">
						Rules are a snapshot taken when the session was created. Edits apply
						to this session only.
					</p>
				</div>
			) : null}
		</BottomSheet>
	);
}
