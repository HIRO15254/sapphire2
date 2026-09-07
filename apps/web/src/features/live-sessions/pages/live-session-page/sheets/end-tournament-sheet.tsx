import { TournamentCompleteForm } from "@/features/live-sessions/components/tournament-complete-form";
import { CrystFormSheet } from "./cryst-form-sheet";

const FORM_ID = "cryst-end-tournament-form";

export type TournamentCompleteValues =
	| {
			beforeDeadline: false;
			bountyPrizes: number;
			placement: number;
			prizeMoney: number;
			totalEntries: number;
	  }
	| {
			beforeDeadline: true;
			bountyPrizes: number;
			prizeMoney: number;
	  };

interface EndTournamentSheetProps {
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: TournamentCompleteValues) => void;
	open: boolean;
}

export function EndTournamentSheet({
	isPending,
	onOpenChange,
	onSubmit,
	open,
}: EndTournamentSheetProps) {
	return (
		<CrystFormSheet
			className="h-auto max-h-[calc(100svh-2rem)]"
			formId={FORM_ID}
			isLoading={isPending}
			onOpenChange={onOpenChange}
			open={open}
			title="End session"
		>
			<div className="flex flex-col gap-3">
				<TournamentCompleteForm formId={FORM_ID} onSubmit={onSubmit} />
			</div>
		</CrystFormSheet>
	);
}
