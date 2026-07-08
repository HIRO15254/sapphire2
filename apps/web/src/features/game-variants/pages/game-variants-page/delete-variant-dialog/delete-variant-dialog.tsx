import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

interface DeleteVariantDialogProps {
	name: string;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/**
 * Centered destructive confirmation for deleting a game variant, mirroring
 * `DeleteRoomDialog` / `DeleteGameDialog`. Cash games and tournaments already
 * recorded against this variant keep their own frozen `variant` text, so the
 * copy clarifies deletion only removes the reusable definition.
 */
export function DeleteVariantDialog({
	name,
	onConfirm,
	onOpenChange,
	open,
}: DeleteVariantDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete this game variant?</DialogTitle>
					<DialogDescription>
						{name} will be removed permanently. Cash games and tournaments
						already using it keep their recorded variant name. This cannot be
						undone.
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
