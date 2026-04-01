import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CreateCashGameSessionForm } from "@/components/live-cash-game/create-cash-game-session-form";
import { CreateTournamentSessionForm } from "@/components/live-tournament/create-tournament-session-form";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { trpc, trpcClient } from "@/utils/trpc";

type SessionType = "cash_game" | "tournament";

function useStoreRingGames(storeId: string | undefined) {
	const ringGamesQuery = useQuery({
		...trpc.ringGame.listByStore.queryOptions({ storeId: storeId ?? "" }),
		enabled: !!storeId,
	});
	return (ringGamesQuery.data ?? []).map((g) => ({
		id: g.id,
		name: g.name,
		maxBuyIn: g.maxBuyIn,
		currencyId: g.currencyId,
	}));
}

function useStoreTournaments(storeId: string | undefined) {
	const tournamentsQuery = useQuery({
		...trpc.tournament.listByStore.queryOptions({
			storeId: storeId ?? "",
			includeArchived: false,
		}),
		enabled: !!storeId,
	});
	return (tournamentsQuery.data ?? []).map((t) => ({
		id: t.id,
		name: t.name,
		buyIn: t.buyIn,
		entryFee: t.entryFee,
		startingStack: t.startingStack,
		currencyId: t.currencyId,
	}));
}

interface CreateSessionDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function CreateSessionDialog({
	open,
	onOpenChange,
}: CreateSessionDialogProps) {
	const [sessionType, setSessionType] = useState<SessionType>("cash_game");
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const storesQuery = useQuery(trpc.store.list.queryOptions());
	const stores = (storesQuery.data ?? []).map((s) => ({
		id: s.id,
		name: s.name,
	}));

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = (currenciesQuery.data ?? []).map((c) => ({
		id: c.id,
		name: c.name,
	}));

	const ringGames = useStoreRingGames(selectedStoreId);
	const tournaments = useStoreTournaments(selectedStoreId);

	const cashListKey = trpc.liveCashGameSession.list.queryOptions({}).queryKey;
	const tournamentListKey = trpc.liveTournamentSession.list.queryOptions(
		{}
	).queryKey;

	const createCashMutation = useMutation({
		mutationFn: (values: {
			currencyId?: string;
			initialBuyIn: number;
			memo?: string;
			ringGameId?: string;
			storeId?: string;
		}) => trpcClient.liveCashGameSession.create.mutate(values),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: cashListKey });
			onOpenChange(false);
			await navigate({ to: "/active-session" });
		},
	});

	const createTournamentMutation = useMutation({
		mutationFn: async (values: {
			currencyId?: string;
			memo?: string;
			startingStack: number;
			storeId?: string;
			tournamentId?: string;
		}) => {
			const { startingStack, ...createValues } = values;
			const result =
				await trpcClient.liveTournamentSession.create.mutate(createValues);
			// Create initial tournament_stack_record with starting stack
			await trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: result.id,
				eventType: "tournament_stack_record",
				payload: {
					stackAmount: startingStack,
					remainingPlayers: null,
					averageStack: null,
					rebuy: null,
					addon: null,
				},
			});
			return result;
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: tournamentListKey });
			onOpenChange(false);
			await navigate({ to: "/active-session" });
		},
	});

	const handleReset = () => {
		setSelectedStoreId(undefined);
		setSessionType("cash_game");
	};

	const isLoading =
		createCashMutation.isPending || createTournamentMutation.isPending;

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
			<div className="mb-4 flex rounded-lg border border-border p-1">
				<button
					className={cn(
						"flex-1 rounded-md px-3 py-1.5 text-center font-medium text-sm transition-colors",
						sessionType === "cash_game"
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:text-foreground"
					)}
					onClick={() => setSessionType("cash_game")}
					type="button"
				>
					Cash Game
				</button>
				<button
					className={cn(
						"flex-1 rounded-md px-3 py-1.5 text-center font-medium text-sm transition-colors",
						sessionType === "tournament"
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:text-foreground"
					)}
					onClick={() => setSessionType("tournament")}
					type="button"
				>
					Tournament
				</button>
			</div>

			{sessionType === "cash_game" ? (
				<CreateCashGameSessionForm
					currencies={currencies}
					isLoading={isLoading}
					onStoreChange={setSelectedStoreId}
					onSubmit={(values) => createCashMutation.mutate(values)}
					ringGames={ringGames}
					stores={stores}
				/>
			) : (
				<CreateTournamentSessionForm
					currencies={currencies}
					isLoading={isLoading}
					onStoreChange={setSelectedStoreId}
					onSubmit={(values) => createTournamentMutation.mutate(values)}
					stores={stores}
					tournaments={tournaments}
				/>
			)}
		</ResponsiveDialog>
	);
}
