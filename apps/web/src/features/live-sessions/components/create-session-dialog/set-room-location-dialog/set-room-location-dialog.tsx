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
