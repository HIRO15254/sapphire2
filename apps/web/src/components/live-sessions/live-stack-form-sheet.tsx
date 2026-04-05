import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CashGameCompleteForm } from "@/components/live-cash-game/cash-game-complete-form";
import { CashGameStackForm } from "@/components/live-cash-game/cash-game-stack-form";
import { TournamentCompleteForm } from "@/components/live-tournament/tournament-complete-form";
import { TournamentStackForm } from "@/components/live-tournament/tournament-stack-form";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useActiveSession } from "@/hooks/use-active-session";
import { useStackSheet } from "@/hooks/use-stack-sheet";
import { trpc, trpcClient } from "@/utils/trpc";

function CashGameStackSheet({ sessionId }: { sessionId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const stackSheet = useStackSheet();
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [defaultFinalStack, setDefaultFinalStack] = useState<
		number | undefined
	>(undefined);

	const sessionKey = trpc.liveCashGameSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;
	const eventsKey = trpc.sessionEvent.list.queryOptions({
		liveCashGameSessionId: sessionId,
	}).queryKey;
	const listKey = trpc.liveCashGameSession.list.queryOptions({}).queryKey;

	const invalidateSession = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: sessionKey }),
			queryClient.invalidateQueries({ queryKey: eventsKey }),
		]);
	};

	const stackMutation = useMutation({
		mutationFn: (values: {
			allIns: Array<{
				potSize: number;
				trials: number;
				equity: number;
				wins: number;
			}>;
			stackAmount: number;
		}) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "stack_record",
				payload: { stackAmount: values.stackAmount, allIns: values.allIns },
			}),
		onSuccess: invalidateSession,
	});

	const chipAddMutation = useMutation({
		mutationFn: (amount: number) =>
			trpcClient.sessionEvent.create.mutate({
				liveCashGameSessionId: sessionId,
				eventType: "chip_add",
				payload: { amount },
			}),
		onSuccess: invalidateSession,
	});

	const completeMutation = useMutation({
		mutationFn: (values: { finalStack: number }) =>
			trpcClient.liveCashGameSession.complete.mutate({
				id: sessionId,
				finalStack: values.finalStack,
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			await navigate({ to: "/sessions" });
		},
	});

	return (
		<>
			<ResponsiveDialog
				description="Record the latest stack and any related all-ins or addons for this cash game."
				onOpenChange={stackSheet.setIsOpen}
				open={stackSheet.isOpen}
				title="Record Stack"
			>
				<CashGameStackForm
					isLoading={stackMutation.isPending}
					onChipAdd={(amount) => chipAddMutation.mutate(amount)}
					onComplete={(currentStack) => {
						stackSheet.close();
						setDefaultFinalStack(currentStack);
						setIsCompleteOpen(true);
					}}
					onSubmit={(values) => {
						stackMutation.mutate(values);
						stackSheet.close();
					}}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				description="Enter the final stack to complete this cash game session."
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Session"
			>
				<CashGameCompleteForm
					defaultFinalStack={defaultFinalStack}
					isLoading={completeMutation.isPending}
					onSubmit={(values) => completeMutation.mutate(values)}
				/>
			</ResponsiveDialog>
		</>
	);
}

function TournamentStackSheet({ sessionId }: { sessionId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const stackSheet = useStackSheet();
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);

	const sessionQuery = useQuery({
		...trpc.liveTournamentSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});
	const tournamentId = sessionQuery.data?.tournamentId ?? null;

	const chipPurchaseTypesQuery = useQuery({
		...trpc.tournamentChipPurchase.listByTournament.queryOptions({
			tournamentId: tournamentId ?? "",
		}),
		enabled: !!tournamentId,
	});
	const chipPurchaseTypes = (chipPurchaseTypesQuery.data ?? []).map((t) => ({
		name: t.name,
		cost: t.cost,
		chips: t.chips,
	}));

	const sessionKey = trpc.liveTournamentSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;
	const eventsKey = trpc.sessionEvent.list.queryOptions({
		liveTournamentSessionId: sessionId,
	}).queryKey;
	const listKey = trpc.liveTournamentSession.list.queryOptions({}).queryKey;

	const invalidateSession = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: sessionKey }),
			queryClient.invalidateQueries({ queryKey: eventsKey }),
		]);
	};

	const stackMutation = useMutation({
		mutationFn: (values: {
			chipPurchaseCounts: Array<{
				name: string;
				count: number;
				chipsPerUnit: number;
			}>;
			chipPurchases: Array<{ name: string; cost: number; chips: number }>;
			remainingPlayers: number | null;
			stackAmount: number;
			totalEntries: number | null;
		}) =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType: "tournament_stack_record",
				payload: {
					stackAmount: values.stackAmount,
					remainingPlayers: values.remainingPlayers,
					totalEntries: values.totalEntries,
					chipPurchases: values.chipPurchases,
					chipPurchaseCounts: values.chipPurchaseCounts,
				},
			}),
		onSuccess: invalidateSession,
	});

	const completeMutation = useMutation({
		mutationFn: (values: {
			bountyPrizes?: number;
			placement: number;
			prizeMoney: number;
			totalEntries: number;
		}) =>
			trpcClient.liveTournamentSession.complete.mutate({
				id: sessionId,
				placement: values.placement,
				totalEntries: values.totalEntries,
				prizeMoney: values.prizeMoney,
				bountyPrizes: values.bountyPrizes,
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			await navigate({ to: "/sessions" });
		},
	});

	return (
		<>
			<ResponsiveDialog
				description="Record the latest stack, remaining players, and chip purchases for this tournament."
				onOpenChange={stackSheet.setIsOpen}
				open={stackSheet.isOpen}
				title="Record Stack"
			>
				<TournamentStackForm
					chipPurchaseTypes={chipPurchaseTypes}
					isLoading={stackMutation.isPending}
					onComplete={() => {
						stackSheet.close();
						setIsCompleteOpen(true);
					}}
					onSubmit={(values) => {
						stackMutation.mutate(values);
						stackSheet.close();
					}}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				description="Enter the tournament result to complete this live session."
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Tournament"
			>
				<TournamentCompleteForm
					isLoading={completeMutation.isPending}
					onSubmit={(values) => completeMutation.mutate(values)}
				/>
			</ResponsiveDialog>
		</>
	);
}

export function LiveStackFormSheet() {
	const { activeSession } = useActiveSession();

	if (!activeSession) {
		return null;
	}

	return activeSession.type === "cash_game" ? (
		<CashGameStackSheet sessionId={activeSession.id} />
	) : (
		<TournamentStackSheet sessionId={activeSession.id} />
	);
}
