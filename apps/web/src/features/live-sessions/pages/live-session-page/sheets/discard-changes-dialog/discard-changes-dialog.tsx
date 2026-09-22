import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { CRYST_SCOPE_CLASS } from "../../cryst-scope";

interface DiscardChangesDialogProps {
	onConfirmDiscard: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function DiscardChangesDialog({
	onConfirmDiscard,
	onOpenChange,
	open,
}: DiscardChangesDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className={cn(CRYST_SCOPE_CLASS)}>
				<DialogHeader>
					<DialogTitle>Discard changes?</DialogTitle>
					<DialogDescription>
						You have unsaved changes. Closing now discards them.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Keep editing
					</Button>
					<Button
						onClick={onConfirmDiscard}
						type="button"
						variant="destructive"
					>
						Discard
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
