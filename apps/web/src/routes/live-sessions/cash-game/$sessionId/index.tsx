import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CashGameCompleteForm } from "@/components/live-cash-game/cash-game-complete-form";
import { CashGameStackForm } from "@/components/live-cash-game/cash-game-stack-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { formatCompactNumber } from "@/utils/format-number";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/live-sessions/cash-game/$sessionId/")({
	component: CashGameSessionPage,
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

function CompactSummary({
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
			{summary.cashOut !== null && (
				<div>
					<span className="text-muted-foreground text-xs">Cash Out</span>
					<p className="font-semibold">
						{formatCompactNumber(summary.cashOut)}
					</p>
				</div>
			)}
		</div>
	);
}

function CashGameSessionPage() {
	const { sessionId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);
	const [defaultCashOut, setDefaultCashOut] = useState<number | undefined>(
		undefined
	);

	const sessionQuery = useQuery(
		trpc.liveCashGameSession.getById.queryOptions({ id: sessionId })
	);
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
			addon: { amount: number } | null;
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
				eventType: "cash_game_stack_record",
				payload: values,
			}),
		onSuccess: invalidateSession,
	});

	const reopenMutation = useMutation({
		mutationFn: () =>
			trpcClient.liveCashGameSession.reopen.mutate({ id: sessionId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: sessionKey });
			await queryClient.invalidateQueries({ queryKey: listKey });
		},
	});

	const completeMutation = useMutation({
		mutationFn: (values: { cashOut: number }) =>
			trpcClient.liveCashGameSession.complete.mutate({
				id: sessionId,
				cashOut: values.cashOut,
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

	if (!session) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	const isActive = session.status === "active";
	const isCompleted = session.status === "completed";

	return (
		<div className="flex h-[calc(100dvh-4rem)] flex-col px-4 pt-2 pb-0 md:px-6 md:pt-4">
			{/* Compact header */}
			<div className="mb-2 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h1 className="font-bold text-lg">Cash Game</h1>
					<Badge
						className={cn(
							"text-[10px]",
							isActive
								? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
								: "border-border bg-muted text-muted-foreground"
						)}
						variant="outline"
					>
						{isActive ? "Active" : "Completed"}
					</Badge>
				</div>

				{isActive && (
					<button
						className="text-destructive/60 text-xs hover:text-destructive"
						onClick={() => setIsDiscardOpen(true)}
						type="button"
					>
						Discard
					</button>
				)}
			</div>

			{/* Summary - fills main area */}
			<div className="min-h-0 flex-1">
				<div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
					<CompactSummary summary={session.summary} />
				</div>

				{session.memo && (
					<p className="mt-2 text-muted-foreground text-xs">{session.memo}</p>
				)}

				{isCompleted && (
					<div className="mt-6 flex flex-col items-center gap-3">
						<p className="text-muted-foreground text-sm">
							Session completed and saved to history.
						</p>
						<Button
							disabled={reopenMutation.isPending}
							onClick={() => reopenMutation.mutate()}
							variant="outline"
						>
							{reopenMutation.isPending ? "Reopening..." : "Reopen Session"}
						</Button>
					</div>
				)}
			</div>

			{/* Stack form - fixed at bottom */}
			{isActive && (
				<div className="border-border border-t pt-2 pb-1">
					<CashGameStackForm
						isLoading={stackMutation.isPending}
						onComplete={(currentStack) => {
							setDefaultCashOut(currentStack);
							setIsCompleteOpen(true);
						}}
						onSubmit={(values) => stackMutation.mutate(values)}
					/>
				</div>
			)}

			{/* Complete dialog */}
			<ResponsiveDialog
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Session"
			>
				<CashGameCompleteForm
					defaultCashOut={defaultCashOut}
					isLoading={completeMutation.isPending}
					onSubmit={(values) => completeMutation.mutate(values)}
				/>
			</ResponsiveDialog>

			{/* Discard confirm dialog */}
			<ResponsiveDialog
				onOpenChange={setIsDiscardOpen}
				open={isDiscardOpen}
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
						<Button
							onClick={() => setIsDiscardOpen(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={discardMutation.isPending}
							onClick={() => discardMutation.mutate()}
							type="button"
							variant="destructive"
						>
							{discardMutation.isPending ? "Discarding..." : "Discard"}
						</Button>
					</div>
				</div>
			</ResponsiveDialog>
		</div>
	);
}
