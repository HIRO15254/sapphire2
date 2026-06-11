import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

interface DeleteCurrencyDialogProps {
	currencyName: string;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function DeleteCurrencyDialog({
	currencyName,
	onConfirm,
	onOpenChange,
	open,
}: DeleteCurrencyDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete this currency?</DialogTitle>
					<DialogDescription>
						{currencyName} and all of its transactions will be removed
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
