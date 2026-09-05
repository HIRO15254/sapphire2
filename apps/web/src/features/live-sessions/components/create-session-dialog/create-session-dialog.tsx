import { FormSheet } from "@/shared/components/form-sheet";
import { LiveSessionForm } from "./live-session-form";
import { SetRoomLocationDialog } from "./set-room-location-dialog";
import { useCreateSessionDialog } from "./use-create-session-dialog";

const LIVE_SESSION_FORM_ID = "live-session-form";

interface CreateSessionDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function CreateSessionDialog({
	open,
	onOpenChange,
}: CreateSessionDialogProps) {
	const {
		rooms,
		currencies,
		ringGames,
		tournaments,
		setSelectedRoomId,
		defaultRoomId,
		handleSubmit,
		locationPrompt,
		isLoading,
		handleReset,
	} = useCreateSessionDialog({ onOpenChange, open });

	return (
		<>
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
					defaultRoomId={defaultRoomId}
					formId={LIVE_SESSION_FORM_ID}
					onRoomChange={setSelectedRoomId}
					onSubmit={handleSubmit}
					ringGames={ringGames}
					rooms={rooms}
					tournaments={tournaments}
				/>
			</FormSheet>
			<SetRoomLocationDialog
				onOpenChange={locationPrompt.onOpenChange}
				onSave={locationPrompt.onSave}
				onSkip={locationPrompt.onSkip}
				open={locationPrompt.open}
				roomName={locationPrompt.roomName}
			/>
		</>
	);
}
