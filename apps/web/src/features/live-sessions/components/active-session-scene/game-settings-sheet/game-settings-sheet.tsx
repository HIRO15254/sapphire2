import { ActiveSessionGameScene } from "@/features/live-sessions/components/active-session-game-scene";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";

interface GameSettingsSheetProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/**
 * Full-height sheet wrapping the game scene (assign / view / edit the linked
 * ring game or tournament) — replaces the retired /active-session/game route.
 * The scene renders its own heading + edit action, so the drawer title stays
 * sr-only.
 */
export function GameSettingsSheet({
	onOpenChange,
	open,
}: GameSettingsSheetProps) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="h-[calc(100svh-2rem)] rounded-t-xl">
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<DrawerTitle className="sr-only">Game settings</DrawerTitle>
				<DrawerDescription className="sr-only">
					View and edit the game linked to this session.
				</DrawerDescription>
				<div className="flex-1 overflow-y-auto px-4 py-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{open ? <ActiveSessionGameScene /> : null}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
