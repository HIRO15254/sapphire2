import { CrystConfirmDialog } from "../cryst-confirm-dialog";

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
		<CrystConfirmDialog
			cancelLabel="Keep editing"
			confirmLabel="Discard"
			description="You have unsaved changes. Closing now discards them."
			onConfirm={onConfirmDiscard}
			onOpenChange={onOpenChange}
			open={open}
			title="Discard changes?"
		/>
	);
}
