import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

interface SetRoomLocationDialogProps {
	onOpenChange: (open: boolean) => void;
	onSave: () => void;
	onSkip: () => void;
	open: boolean;
	roomName: string;
}

/**
 * Centered prompt shown when a live session starts in a room that has no saved
 * location (SA2-100). Offers to stamp the device's current location onto the
 * room so it can be auto-selected next time. Dismissing or "Not now" starts the
 * session without touching the room; "Save location" saves then starts.
 */
export function SetRoomLocationDialog({
	onOpenChange,
	onSave,
	onSkip,
	open,
	roomName,
}: SetRoomLocationDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Save this room's location?</DialogTitle>
					<DialogDescription>
						{roomName} has no saved location. Save your current location to it
						so it can be auto-selected next time you start a session here.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button onClick={onSkip} type="button" variant="outline">
						Not now
					</Button>
					<Button onClick={onSave} type="button">
						Save location
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
