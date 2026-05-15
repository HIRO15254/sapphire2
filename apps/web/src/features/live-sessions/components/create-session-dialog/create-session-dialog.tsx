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
		stores,
		currencies,
		ringGames,
		tournaments,
		setSelectedStoreId,
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
				onStoreChange={setSelectedStoreId}
				onSubmit={handleSubmit}
				ringGames={ringGames}
				stores={stores}
				submitLabel="Start session"
				tournaments={tournaments}
			/>
		</ResponsiveDialog>
	);
}
