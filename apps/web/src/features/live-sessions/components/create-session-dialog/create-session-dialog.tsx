import { SessionFormSheet } from "@/features/sessions/components/session-form-sheet";
import { SessionWizard } from "@/features/sessions/components/session-wizard";
import { useCreateSessionDialog } from "./use-create-session-dialog";

interface CreateSessionDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/**
 * V2 full-height sheet for starting a live session. The SessionWizard drives
 * its own multi-step navigation and final submit, so the sheet has no check
 * button of its own.
 */
export function CreateSessionDialog({
	open,
	onOpenChange,
}: CreateSessionDialogProps) {
	const {
		rooms,
		currencies,
		ringGames,
		tournaments,
		promotableSessions,
		setSelectedRoomId,
		handleSubmit,
		isLoading,
		handleReset,
	} = useCreateSessionDialog({ onOpenChange });

	return (
		<SessionFormSheet
			onOpenChange={(o) => {
				onOpenChange(o);
				if (!o) {
					handleReset();
				}
			}}
			open={open}
			title="New Session"
		>
			<SessionWizard
				currencies={currencies}
				isLoading={isLoading}
				mode="live"
				onRoomChange={setSelectedRoomId}
				onSubmit={handleSubmit}
				promotableSessions={promotableSessions}
				ringGames={ringGames}
				rooms={rooms}
				submitLabel="Start session"
				tournaments={tournaments}
			/>
		</SessionFormSheet>
	);
}
