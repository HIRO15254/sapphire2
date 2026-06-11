import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

interface DeleteGameDialogProps {
	/** Lowercase entity label, e.g. "cash game" / "tournament". */
	label: string;
	name: string;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/**
 * Centered destructive confirmation for deleting a game / tournament,
 * mirroring `DeleteCurrencyDialog`. Bottom sheets are reserved for entry; a
 * one-tap-to-confirm prompt stays a modal so the affordance is unambiguous.
 */
export function DeleteGameDialog({
	label,
	name,
	onConfirm,
	onOpenChange,
	open,
}: DeleteGameDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete this {label}?</DialogTitle>
					<DialogDescription>
						{name} will be removed permanently. This cannot be undone.
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
