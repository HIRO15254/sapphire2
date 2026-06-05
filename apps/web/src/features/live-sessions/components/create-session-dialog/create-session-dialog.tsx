import { SessionWizard } from "@/features/sessions/components/session-wizard";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useCreateSessionDialog } from "./use-create-session-dialog";

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
		handleSubmit,
		isLoading,
		handleReset,
	} = useCreateSessionDialog({ onOpenChange });

	return (
		<ResponsiveDialog
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
				ringGames={ringGames}
				rooms={rooms}
				submitLabel="Start session"
				tournaments={tournaments}
			/>
		</ResponsiveDialog>
	);
}
