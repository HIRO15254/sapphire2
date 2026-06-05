import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

interface DeletePlayerDialogProps {
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	playerName: string;
}

/**
 * Centered destructive confirmation for deleting a player, mirroring
 * `DeleteStoreDialog`. Deleting a player removes its tag links but leaves the
 * tags themselves, so the copy stays simple.
 */
export function DeletePlayerDialog({
	onConfirm,
	onOpenChange,
	open,
	playerName,
}: DeletePlayerDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="theme-v2">
				<DialogHeader>
					<DialogTitle>Delete this player?</DialogTitle>
					<DialogDescription>
						{playerName} will be removed permanently. This cannot be undone.
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
