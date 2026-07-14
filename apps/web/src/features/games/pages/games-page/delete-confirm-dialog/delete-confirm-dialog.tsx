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

export interface DeleteConfirmDialogProps {
	description: ReactNode;
	isPending: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	open: boolean;
	title: string;
}

/**
 * Shared destructive-confirmation dialog for the Games page's three delete
 * flows (group / variant / mix) — same title/description/Cancel/Delete shape
 * for all three, previously copy-pasted verbatim in games-page.tsx.
 */
export function DeleteConfirmDialog({
	description,
	isPending,
	onCancel,
	onConfirm,
	open,
	title,
}: DeleteConfirmDialogProps) {
	return (
		<Dialog
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					onCancel();
				}
			}}
			open={open}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button onClick={onCancel} type="button" variant="outline">
						Cancel
					</Button>
					<Button
						disabled={isPending}
						onClick={onConfirm}
						type="button"
						variant="destructive"
					>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
