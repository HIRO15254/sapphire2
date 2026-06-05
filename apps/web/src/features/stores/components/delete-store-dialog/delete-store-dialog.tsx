import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

interface DeleteStoreDialogProps {
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	storeName: string;
}

/**
 * Centered destructive confirmation for deleting a store, mirroring
 * `DeleteCurrencyDialog`. Deleting a store cascades to all of its cash games
 * and tournaments, so the copy spells that out.
 */
export function DeleteStoreDialog({
	onConfirm,
	onOpenChange,
	open,
	storeName,
}: DeleteStoreDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="theme-v2">
				<DialogHeader>
					<DialogTitle>Delete this store?</DialogTitle>
					<DialogDescription>
						{storeName} and all of its cash games and tournaments will be
						removed permanently. This cannot be undone.
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
