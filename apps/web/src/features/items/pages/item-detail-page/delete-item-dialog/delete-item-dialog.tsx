import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

interface DeleteItemDialogProps {
	itemName: string;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function DeleteItemDialog({
	itemName,
	onConfirm,
	onOpenChange,
	open,
}: DeleteItemDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete this item?</DialogTitle>
					<DialogDescription>
						{itemName} will be removed permanently. This cannot be undone. Items
						that already have transactions cannot be deleted.
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
