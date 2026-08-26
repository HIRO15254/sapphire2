import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { CRYST_SCOPE } from "@/shared/lib/theme";

interface DiscardDialogProps {
	isOpen: boolean;
	isPending: boolean;
	onClose: () => void;
	onConfirm: () => void;
}

export function DiscardDialog({
	isOpen,
	isPending,
	onClose,
	onConfirm,
}: DiscardDialogProps) {
	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={isOpen}
		>
			<DialogContent className={CRYST_SCOPE}>
				<DialogHeader>
					<DialogTitle>Discard session</DialogTitle>
					<DialogDescription>
						This will permanently delete this session and all its events.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button onClick={onClose} type="button" variant="outline">
						Cancel
					</Button>
					<Button
						disabled={isPending}
						onClick={onConfirm}
						type="button"
						variant="destructive"
					>
						{isPending ? "Discarding..." : "Discard"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
