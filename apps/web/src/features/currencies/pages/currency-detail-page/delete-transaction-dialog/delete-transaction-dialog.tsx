import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

interface DeleteTransactionDialogProps {
	onCancel: () => void;
	onConfirm: () => void;
	open: boolean;
}

export function DeleteTransactionDialog({
	onCancel,
	onConfirm,
	open,
}: DeleteTransactionDialogProps) {
	return (
		<Dialog
			onOpenChange={(next) => {
				if (!next) {
					onCancel();
				}
			}}
			open={open}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete this transaction?</DialogTitle>
					<DialogDescription>
						This transaction will be removed permanently. This cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button onClick={onCancel} type="button" variant="outline">
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
