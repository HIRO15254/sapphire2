import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

interface DeleteSessionDialogProps {
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/**
 * Centered destructive confirmation for deleting a session, mirroring
 * `DeletePlayerDialog`. Deleting a session also unwinds its linked currency
 * transaction server-side, so the copy stays explicit about permanence.
 */
export function DeleteSessionDialog({
	onConfirm,
	onOpenChange,
	open,
}: DeleteSessionDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="theme-v2">
				<DialogHeader>
					<DialogTitle>Delete this session?</DialogTitle>
					<DialogDescription>
						This session and its recorded result will be removed permanently.
						This cannot be undone.
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
