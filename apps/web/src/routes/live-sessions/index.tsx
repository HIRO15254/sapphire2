import { IconPlayerRecord, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CreateCashGameSessionForm } from "@/components/live-cash-game/create-cash-game-session-form";
import { LiveSessionCard } from "@/components/live-sessions/live-session-card";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/live-sessions/")({
	component: LiveSessionsPage,
});

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

function LiveSessionsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>();

	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const sessionsQuery = useQuery(
		trpc.liveCashGameSession.list.queryOptions({})
	);
	const sessions = sessionsQuery.data?.items ?? [];

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

	const sessionListKey = trpc.liveCashGameSession.list.queryOptions(
		{}
	).queryKey;

	const createMutation = useMutation({
		mutationFn: (values: {
			currencyId?: string;
			initialBuyIn: number;
			memo?: string;
			ringGameId?: string;
			storeId?: string;
		}) => trpcClient.liveCashGameSession.create.mutate(values),
		onSuccess: async (data) => {
			await queryClient.invalidateQueries({ queryKey: sessionListKey });
			setIsCreateOpen(false);
			await navigate({
				to: "/live-sessions/cash-game/$sessionId",
				params: { sessionId: data.id },
			});
		},
	});

	const handleCreate = (values: {
		currencyId?: string;
		initialBuyIn: number;
		memo?: string;
		ringGameId?: string;
		storeId?: string;
	}) => {
		createMutation.mutate(values);
	};

	const handleCardClick = (id: string) => {
		navigate({
			to: "/live-sessions/cash-game/$sessionId",
			params: { sessionId: id },
		});
	};

	return (
		<div className="p-4 md:p-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Live Sessions</h1>
				<Button onClick={() => setIsCreateOpen(true)}>
					<IconPlus size={16} />
					New Cash Game
				</Button>
			</div>

			{sessions.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
					<IconPlayerRecord size={48} />
					<p className="text-lg">No live sessions yet</p>
					<p className="text-sm">
						Start a live session to track your play in real time.
					</p>
					<Button onClick={() => setIsCreateOpen(true)} variant="outline">
						<IconPlus size={16} />
						New Cash Game
					</Button>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{sessions.map((session) => (
						<LiveSessionCard
							key={session.id}
							onClick={handleCardClick}
							session={{
								id: session.id,
								type: "cash_game",
								status: session.status as "active" | "completed",
								storeName: session.storeName ?? null,
								gameName: session.ringGameName ?? null,
								currencyName: session.currencyName ?? null,
								startedAt: session.startedAt.toString(),
								endedAt: session.endedAt ? session.endedAt.toString() : null,
								memo: session.memo ?? null,
								eventCount: session.eventCount,
							}}
						/>
					))}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={(open) => {
					setIsCreateOpen(open);
					if (!open) {
						setSelectedStoreId(undefined);
					}
				}}
				open={isCreateOpen}
				title="New Cash Game"
			>
				<CreateCashGameSessionForm
					currencies={currencies}
					isLoading={createMutation.isPending}
					onStoreChange={setSelectedStoreId}
					onSubmit={handleCreate}
					ringGames={ringGames}
					stores={stores}
				/>
			</ResponsiveDialog>
		</div>
	);
}
