import { FormSheet } from "@/shared/components/form-sheet";
import { LiveSessionForm } from "./live-session-form";
import { useCreateSessionDialog } from "./use-create-session-dialog";

const LIVE_SESSION_FORM_ID = "live-session-form";

interface CreateSessionDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/**
 * Full-height bottom sheet for starting a live session. Single-screen form
 * (no wizard steps): the FormSheet toolbar's ✓ submits the live form via its
 * `form` id, and rule overrides live behind a collapsed "Customize rules"
 * section, so a session that keeps the master's rules starts in one tap.
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
		<FormSheet
			formId={LIVE_SESSION_FORM_ID}
			isLoading={isLoading}
			onOpenChange={(o) => {
				onOpenChange(o);
				if (!o) {
					handleReset();
				}
			}}
			open={open}
			title="Start Live Session"
		>
			<LiveSessionForm
				currencies={currencies}
				formId={LIVE_SESSION_FORM_ID}
				onRoomChange={setSelectedRoomId}
				onSubmit={handleSubmit}
				promotableSessions={promotableSessions}
				ringGames={ringGames}
				rooms={rooms}
				tournaments={tournaments}
			/>
		</FormSheet>
	);
}
