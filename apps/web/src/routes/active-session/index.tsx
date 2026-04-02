import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CashGameCompleteForm } from "@/components/live-cash-game/cash-game-complete-form";
import { CashGameStackForm } from "@/components/live-cash-game/cash-game-stack-form";
import { AddPlayerSheet } from "@/components/live-sessions/add-player-sheet";
import {
	PokerTable,
	type TablePlayer,
} from "@/components/live-sessions/poker-table";
import { TournamentCompleteForm } from "@/components/live-tournament/tournament-complete-form";
import { TournamentStackForm } from "@/components/live-tournament/tournament-stack-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useActiveSession } from "@/hooks/use-active-session";
import { useTablePlayers } from "@/hooks/use-table-players";
import { cn } from "@/lib/utils";
import { formatCompactNumber } from "@/utils/format-number";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/active-session/")({
	component: ActiveSessionPage,
});

function plColorClass(value: number): string {
	if (value > 0) {
		return "text-green-600 dark:text-green-400";
	}
	if (value < 0) {
		return "text-red-600 dark:text-red-400";
	}
	return "";
}

function formatPl(value: number): string {
	const sign = value >= 0 ? "+" : "";
	return `${sign}${formatCompactNumber(value)}`;
}

function CashGameCompactSummary({
	summary,
}: {
	summary: {
		totalBuyIn: number;
		cashOut: number | null;
		profitLoss: number | null;
		evCashOut: number | null;
		currentStack: number | null;
		addonCount: number;
	};
}) {
	return (
		<div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
			<div>
				<span className="text-muted-foreground text-xs">Buy-in</span>
				<p className="font-semibold">
					{formatCompactNumber(summary.totalBuyIn)}
				</p>
			</div>
			<div>
				<span className="text-muted-foreground text-xs">Stack</span>
				<p className="font-semibold">
					{summary.currentStack !== null
						? formatCompactNumber(summary.currentStack)
						: "-"}
				</p>
			</div>
			<div>
				<span className="text-muted-foreground text-xs">P&L</span>
				<p
					className={cn(
						"font-semibold",
						summary.profitLoss !== null
							? plColorClass(summary.profitLoss)
							: undefined
					)}
				>
					{summary.profitLoss !== null ? formatPl(summary.profitLoss) : "-"}
				</p>
			</div>
			{summary.evCashOut !== null && (
				<div>
					<span className="text-muted-foreground text-xs">EV P&L</span>
					<p className="font-semibold">
						{formatPl(summary.evCashOut - summary.totalBuyIn)}
					</p>
				</div>
			)}
			{summary.addonCount > 0 && (
				<div>
					<span className="text-muted-foreground text-xs">Addons</span>
					<p className="font-semibold">{summary.addonCount}</p>
				</div>
			)}
		</div>
	);
}

function TournamentCompactSummary({
	summary,
}: {
	summary: {
		buyIn: number | null;
		entryFee: number | null;
		currentStack: number | null;
		remainingPlayers: number | null;
		totalEntries: number | null;
		totalChipPurchases: number;
		profitLoss: number | null;
	};
}) {
	const totalCost = (summary.buyIn ?? 0) + (summary.entryFee ?? 0);

	return (
		<div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
			{totalCost > 0 && (
				<div>
					<span className="text-muted-foreground text-xs">Buy-in</span>
					<p className="font-semibold">{formatCompactNumber(totalCost)}</p>
				</div>
			)}
			<div>
				<span className="text-muted-foreground text-xs">Stack</span>
				<p className="font-semibold">
					{summary.currentStack !== null
						? formatCompactNumber(summary.currentStack)
						: "-"}
				</p>
			</div>
			<div>
				<span className="text-muted-foreground text-xs">Remaining</span>
				<p className="font-semibold">
					{summary.remainingPlayers !== null ? summary.remainingPlayers : "-"}
				</p>
			</div>
			{summary.totalEntries !== null && (
				<div>
					<span className="text-muted-foreground text-xs">Entries</span>
					<p className="font-semibold">{summary.totalEntries}</p>
				</div>
			)}
			{summary.totalChipPurchases > 0 && (
				<div>
					<span className="text-muted-foreground text-xs">Chip Purchases</span>
					<p className="font-semibold">{summary.totalChipPurchases}</p>
				</div>
			)}
			{summary.profitLoss !== null && (
				<div>
					<span className="text-muted-foreground text-xs">P&L</span>
					<p className={cn("font-semibold", plColorClass(summary.profitLoss))}>
						{formatPl(summary.profitLoss)}
					</p>
				</div>
			)}
		</div>
	);
}

function buildTournamentSummary(session: {
	summary: Record<string, unknown>;
}): {
	buyIn: number | null;
	entryFee: number | null;
	currentStack: number | null;
	remainingPlayers: number | null;
	totalEntries: number | null;
	totalChipPurchases: number;
	profitLoss: number | null;
} {
	const s = session.summary as Record<string, unknown>;
	return {
		buyIn: typeof s.buyIn === "number" ? s.buyIn : null,
		entryFee: typeof s.entryFee === "number" ? s.entryFee : null,
		currentStack: typeof s.currentStack === "number" ? s.currentStack : null,
		remainingPlayers:
			typeof s.remainingPlayers === "number" ? s.remainingPlayers : null,
		totalEntries: typeof s.totalEntries === "number" ? s.totalEntries : null,
		totalChipPurchases:
			typeof s.totalChipPurchases === "number" ? s.totalChipPurchases : 0,
		profitLoss: typeof s.profitLoss === "number" ? s.profitLoss : null,
	};
}

function useHeroSeat(
	sessionType: "cash_game" | "tournament",
	sessionId: string,
	currentHeroSeat: number
) {
	const queryClient = useQueryClient();

	const cashSessionKey = trpc.liveCashGameSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;
	const tournamentSessionKey = trpc.liveTournamentSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;

	const heroMutation = useMutation({
		mutationFn: (heroSeatPosition: number) =>
			sessionType === "cash_game"
				? trpcClient.liveCashGameSession.updateHeroSeat.mutate({
						id: sessionId,
						heroSeatPosition,
					})
				: trpcClient.liveTournamentSession.updateHeroSeat.mutate({
						id: sessionId,
						heroSeatPosition,
					}),
		onSuccess: () => {
			const key =
				sessionType === "cash_game" ? cashSessionKey : tournamentSessionKey;
			queryClient.invalidateQueries({ queryKey: key });
		},
	});

	return {
		heroSeatPosition: currentHeroSeat,
		setHeroSeat: (pos: number) => heroMutation.mutate(pos),
	};
}

function CashGameSession({ sessionId }: { sessionId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);
	const [defaultFinalStack, setDefaultFinalStack] = useState<
		number | undefined
	>(undefined);

	const sessionQuery = useQuery({
		...trpc.liveCashGameSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
		refetchInterval: 5000,
	});
	const session = sessionQuery.data;

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

	const discardMutation = useMutation({
		mutationFn: () =>
			trpcClient.liveCashGameSession.discard.mutate({ id: sessionId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			await navigate({ to: "/sessions" });
		},
	});

	const tablePlayers = useTablePlayers({
		liveCashGameSessionId: sessionId,
	});

	const heroSeat = useHeroSeat(
		"cash_game",
		sessionId,
		session?.heroSeatPosition ?? 0
	);

	if (!session) {
		return null;
	}

	return (
		<>
			{/* Compact header */}
			<div className="mb-2 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h1 className="font-bold text-lg">Cash Game</h1>
					<Badge
						className="border-green-200 bg-green-50 text-[10px] text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
						variant="outline"
					>
						Active
					</Badge>
				</div>

				<button
					className="text-destructive/60 text-xs hover:text-destructive"
					onClick={() => setIsDiscardOpen(true)}
					type="button"
				>
					Discard
				</button>
			</div>

			{/* Summary */}
			<div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
				<CashGameCompactSummary summary={session.summary} />
			</div>

			{session.memo && (
				<p className="mt-1 text-muted-foreground text-xs">{session.memo}</p>
			)}

			{/* Poker table - center area */}
			<div className="min-h-0 flex-1 py-2">
				<PokerTable
					heroSeatPosition={heroSeat.heroSeatPosition}
					onAddPlayer={tablePlayers.handleAddPlayer}
					onHeroSeatChange={heroSeat.setHeroSeat}
					onRemovePlayer={tablePlayers.handleRemovePlayer}
					players={tablePlayers.players as TablePlayer[]}
				/>
			</div>

			{/* Stack form - fixed at bottom */}
			<div className="border-border border-t pt-2 pb-1">
				<CashGameStackForm
					isLoading={stackMutation.isPending}
					onChipAdd={(amount) => chipAddMutation.mutate(amount)}
					onComplete={(currentStack) => {
						setDefaultFinalStack(currentStack);
						setIsCompleteOpen(true);
					}}
					onSubmit={(values) => stackMutation.mutate(values)}
				/>
			</div>

			{/* Complete dialog */}
			<ResponsiveDialog
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

			{/* Add player sheet */}
			<AddPlayerSheet
				excludePlayerIds={tablePlayers.excludePlayerIds}
				onAddExisting={tablePlayers.handleAddExisting}
				onAddNew={tablePlayers.handleAddNew}
				onOpenChange={tablePlayers.setAddPlayerSheetOpen}
				open={tablePlayers.addPlayerSheetOpen}
			/>

			{/* Discard confirm dialog */}
			<DiscardDialog
				isOpen={isDiscardOpen}
				isPending={discardMutation.isPending}
				onClose={() => setIsDiscardOpen(false)}
				onConfirm={() => discardMutation.mutate()}
			/>
		</>
	);
}

function TournamentSession({ sessionId }: { sessionId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);

	const sessionQuery = useQuery({
		...trpc.liveTournamentSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
		refetchInterval: 5000,
	});
	const session = sessionQuery.data;

	const tournamentId = session?.tournamentId ?? null;

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

	const discardMutation = useMutation({
		mutationFn: () =>
			trpcClient.liveTournamentSession.discard.mutate({ id: sessionId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			await navigate({ to: "/sessions" });
		},
	});

	const tablePlayers = useTablePlayers({
		liveTournamentSessionId: sessionId,
	});

	const heroSeat = useHeroSeat(
		"tournament",
		sessionId,
		session?.heroSeatPosition ?? 0
	);

	if (!session) {
		return null;
	}

	const tournamentSummary = buildTournamentSummary(
		session as { summary: Record<string, unknown> }
	);

	return (
		<>
			{/* Compact header */}
			<div className="mb-2 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h1 className="font-bold text-lg">Tournament</h1>
					<Badge
						className="border-green-200 bg-green-50 text-[10px] text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
						variant="outline"
					>
						Active
					</Badge>
				</div>

				<button
					className="text-destructive/60 text-xs hover:text-destructive"
					onClick={() => setIsDiscardOpen(true)}
					type="button"
				>
					Discard
				</button>
			</div>

			{/* Summary */}
			<div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
				<TournamentCompactSummary summary={tournamentSummary} />
			</div>

			{session.memo && (
				<p className="mt-1 text-muted-foreground text-xs">{session.memo}</p>
			)}

			{/* Poker table - center area */}
			<div className="min-h-0 flex-1 py-2">
				<PokerTable
					heroSeatPosition={heroSeat.heroSeatPosition}
					onAddPlayer={tablePlayers.handleAddPlayer}
					onHeroSeatChange={heroSeat.setHeroSeat}
					onRemovePlayer={tablePlayers.handleRemovePlayer}
					players={tablePlayers.players as TablePlayer[]}
				/>
			</div>

			{/* Stack form - fixed at bottom */}
			<div className="border-border border-t pt-2 pb-1">
				<TournamentStackForm
					chipPurchaseTypes={chipPurchaseTypes}
					isLoading={stackMutation.isPending}
					onComplete={() => setIsCompleteOpen(true)}
					onSubmit={(values) => stackMutation.mutate(values)}
				/>
			</div>

			{/* Complete dialog */}
			<ResponsiveDialog
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Tournament"
			>
				<TournamentCompleteForm
					isLoading={completeMutation.isPending}
					onSubmit={(values) => completeMutation.mutate(values)}
				/>
			</ResponsiveDialog>

			{/* Add player sheet */}
			<AddPlayerSheet
				excludePlayerIds={tablePlayers.excludePlayerIds}
				onAddExisting={tablePlayers.handleAddExisting}
				onAddNew={tablePlayers.handleAddNew}
				onOpenChange={tablePlayers.setAddPlayerSheetOpen}
				open={tablePlayers.addPlayerSheetOpen}
			/>

			{/* Discard confirm dialog */}
			<DiscardDialog
				isOpen={isDiscardOpen}
				isPending={discardMutation.isPending}
				onClose={() => setIsDiscardOpen(false)}
				onConfirm={() => discardMutation.mutate()}
			/>
		</>
	);
}

function DiscardDialog({
	isOpen,
	isPending,
	onClose,
	onConfirm,
}: {
	isOpen: boolean;
	isPending: boolean;
	onClose: () => void;
	onConfirm: () => void;
}) {
	return (
		<ResponsiveDialog
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={isOpen}
			title="Discard Session"
		>
			<div className="flex flex-col gap-4">
				<div className="flex items-start gap-3 text-destructive">
					<IconAlertTriangle className="mt-0.5 shrink-0" size={20} />
					<p className="text-sm">
						This will permanently delete this session and all its events.
					</p>
				</div>
				<div className="flex justify-end gap-2">
					<Button onClick={onClose} type="button" variant="outline">
						Cancel
					</Button>
					<Button
						disabled={isPending}
						onClick={onConfirm}
						type="button"
						variant="destructive"
					>
						{isPending ? "Discarding..." : "Discard"}
					</Button>
				</div>
			</div>
		</ResponsiveDialog>
	);
}

function ActiveSessionPage() {
	const { activeSession, isLoading: isSessionLoading } = useActiveSession();

	if (isSessionLoading) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (!activeSession) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">No active session</p>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100dvh-4rem)] flex-col px-4 pt-2 pb-0 md:px-6 md:pt-4">
			{activeSession.type === "cash_game" ? (
				<CashGameSession sessionId={activeSession.id} />
			) : (
				<TournamentSession sessionId={activeSession.id} />
			)}
		</div>
	);
}
