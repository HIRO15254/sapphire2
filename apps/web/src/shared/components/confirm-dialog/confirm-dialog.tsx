import { IconTrash } from "@tabler/icons-react";
import type { ReactNode } from "react";
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
	confirmIcon?: ReactNode;
	confirmLabel?: string;
	description: string;
	destructive?: boolean;
	isPending?: boolean;
	onConfirm?: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function ConfirmDialog({
	confirmIcon = <IconTrash aria-hidden />,
	confirmLabel = "Delete",
	description,
	destructive = true,
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
					{onConfirm ? (
						<Button
							aria-busy={isPending}
							disabled={isPending}
							onClick={onConfirm}
							type="button"
							variant={destructive ? "destructive" : "default"}
						>
							{confirmIcon}
							{confirmLabel}
						</Button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
