import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CashGameCompleteForm } from "@/components/live-cash-game/cash-game-complete-form";
import { CashGameStackForm } from "@/components/live-cash-game/cash-game-stack-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useActiveSession } from "@/hooks/use-active-session";
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
		</div>
	);
}

function ActiveSessionPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { activeSession, isLoading: isSessionLoading } = useActiveSession();

	const sessionId = activeSession?.id ?? "";

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

	if (isSessionLoading) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (!(activeSession && session)) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">No active session</p>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100dvh-4rem)] flex-col px-4 pt-2 pb-0 md:px-6 md:pt-4">
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

			{/* Summary - fills main area */}
			<div className="min-h-0 flex-1">
				<div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
					<CompactSummary summary={session.summary} />
				</div>

				{session.memo && (
					<p className="mt-2 text-muted-foreground text-xs">{session.memo}</p>
				)}
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
