import { CreateCashGameSessionForm } from "@/features/live-sessions/components/create-cash-game-session-form";
import { CreateTournamentSessionForm } from "@/features/live-sessions/components/create-tournament-session-form";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useCreateLiveSessionDialog } from "./use-create-live-session-dialog";

interface CreateLiveSessionDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function CreateLiveSessionDialog({
	open,
	onOpenChange,
}: CreateLiveSessionDialogProps) {
	const {
		kind,
		setKind,
		stores,
		currencies,
		ringGames,
		tournaments,
		setSelectedStoreId,
		isLoading,
		handleReset,
		onCreateCash,
		onCreateTournament,
	} = useCreateLiveSessionDialog({ onOpenChange });

	return (
		<ResponsiveDialog
			onOpenChange={(o) => {
				onOpenChange(o);
				if (!o) {
					handleReset();
				}
			}}
			open={open}
			title="New Live Session"
		>
			<Tabs
				className="mb-4"
				onValueChange={(v) => setKind(v as "cash_game" | "tournament")}
				value={kind}
			>
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="cash_game">Cash Game</TabsTrigger>
					<TabsTrigger value="tournament">Tournament</TabsTrigger>
				</TabsList>
			</Tabs>

			{kind === "cash_game" ? (
				<CreateCashGameSessionForm
					currencies={currencies}
					isLoading={isLoading}
					onStoreChange={setSelectedStoreId}
					onSubmit={onCreateCash}
					ringGames={ringGames}
					stores={stores}
				/>
			) : (
				<CreateTournamentSessionForm
					currencies={currencies}
					isLoading={isLoading}
					onStoreChange={setSelectedStoreId}
					onSubmit={onCreateTournament}
					stores={stores}
					tournaments={tournaments}
				/>
			)}
		</ResponsiveDialog>
	);
}
