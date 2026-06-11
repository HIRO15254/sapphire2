import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

interface DeleteRoomDialogProps {
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	roomName: string;
}

/**
 * Centered destructive confirmation for deleting a room, mirroring
 * `DeleteCurrencyDialog`. Deleting a room cascades to all of its cash games
 * and tournaments, so the copy spells that out.
 */
export function DeleteRoomDialog({
	onConfirm,
	onOpenChange,
	open,
	roomName,
}: DeleteRoomDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete this room?</DialogTitle>
					<DialogDescription>
						{roomName} and all of its cash games and tournaments will be removed
						permanently. This cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button onClick={onConfirm} type="button" variant="destructive">
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
