import { IconTrash } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { useConfirmDialog } from "./use-confirm-dialog";

interface ConfirmDialogProps {
	confirmLabel?: string;
	description: string;
	isPending?: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function ConfirmDialog({
	confirmLabel = "Delete",
	description,
	isPending = false,
	onConfirm,
	onOpenChange,
	open,
	title,
}: ConfirmDialogProps) {
	const { onCancel } = useConfirmDialog(onOpenChange);
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button onClick={onCancel} type="button" variant="outline">
						Cancel
					</Button>
					<Button
						aria-busy={isPending}
						disabled={isPending}
						onClick={onConfirm}
						type="button"
						variant="destructive"
					>
						<IconTrash aria-hidden />
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
