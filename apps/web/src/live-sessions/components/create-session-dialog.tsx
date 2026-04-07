import { useState } from "react";
import { CreateCashGameSessionForm } from "@/live-sessions/components/create-cash-game-session-form";
import { CreateTournamentSessionForm } from "@/live-sessions/components/create-tournament-session-form";
import { useCreateSession } from "@/live-sessions/hooks/use-create-session";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

type SessionType = "cash_game" | "tournament";

interface CreateSessionDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function CreateSessionDialog({
	open,
	onOpenChange,
}: CreateSessionDialogProps) {
	const [sessionType, setSessionType] = useState<SessionType>("cash_game");

	const {
		stores,
		currencies,
		ringGames,
		tournaments,
		setSelectedStoreId,
		createCash,
		createTournament,
		isLoading,
	} = useCreateSession({ onClose: () => onOpenChange(false) });

	const handleReset = () => {
		setSelectedStoreId(undefined);
		setSessionType("cash_game");
	};

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
			{/* Session type selector */}
			<Tabs
				className="mb-4"
				onValueChange={(value) => setSessionType(value as SessionType)}
				value={sessionType}
			>
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="cash_game">Cash Game</TabsTrigger>
					<TabsTrigger value="tournament">Tournament</TabsTrigger>
				</TabsList>
			</Tabs>

			{sessionType === "cash_game" ? (
				<CreateCashGameSessionForm
					currencies={currencies}
					isLoading={isLoading}
					onStoreChange={setSelectedStoreId}
					onSubmit={(values) => createCash(values)}
					ringGames={ringGames}
					stores={stores}
				/>
			) : (
				<CreateTournamentSessionForm
					currencies={currencies}
					isLoading={isLoading}
					onStoreChange={setSelectedStoreId}
					onSubmit={(values) => createTournament(values)}
					stores={stores}
					tournaments={tournaments}
				/>
			)}
		</ResponsiveDialog>
	);
}
