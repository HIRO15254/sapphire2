import { CrystConfirmDialog } from "../cryst-confirm-dialog";

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
		<CrystConfirmDialog
			cancelLabel="Cancel"
			confirmLabel="Clear seats"
			description={describeReset(playerCount, isHeroSeated)}
			isPending={isPending}
			onConfirm={onConfirm}
			onOpenChange={onOpenChange}
			open={open}
			title="Clear every seat?"
		/>
	);
}
