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

interface ResetSeatsDialogProps {
	isPending: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	seatedCount: number;
}

export function ResetSeatsDialog({
	isPending,
	onConfirm,
	onOpenChange,
	open,
	seatedCount,
}: ResetSeatsDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className={cn(CRYST_SCOPE_CLASS)}>
				<DialogHeader>
					<DialogTitle>Clear every seat?</DialogTitle>
					<DialogDescription>
						{seatedCount === 1
							? "1 player leaves the table"
							: `${seatedCount} players leave the table`}
						, and your own seat is cleared too. Their stints stay in the session
						history.
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
					<Button
						disabled={isPending}
						onClick={onConfirm}
						type="button"
						variant="destructive"
					>
						Clear seats
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
