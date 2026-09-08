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
	isHeroSeated: boolean;
	isPending: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	playerCount: number;
}

function describeReset(playerCount: number, isHeroSeated: boolean): string {
	if (playerCount === 0) {
		return "Your own seat is cleared.";
	}
	const players =
		playerCount === 1
			? "1 player leaves the table"
			: `${playerCount} players leave the table`;
	const hero = isHeroSeated ? ", and your own seat is cleared too" : "";
	return `${players}${hero}. Their stints stay in the session history.`;
}

export function ResetSeatsDialog({
	isHeroSeated,
	isPending,
	onConfirm,
	onOpenChange,
	open,
	playerCount,
}: ResetSeatsDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className={cn(CRYST_SCOPE_CLASS)}>
				<DialogHeader>
					<DialogTitle>Clear every seat?</DialogTitle>
					<DialogDescription>
						{describeReset(playerCount, isHeroSeated)}
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
