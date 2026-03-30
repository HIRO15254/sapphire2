import {
	IconAlertTriangle,
	IconChevronLeft,
	IconCircleCheck,
	IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CashGameCompleteForm } from "@/components/live-cash-game/cash-game-complete-form";
import { CashGameStackForm } from "@/components/live-cash-game/cash-game-stack-form";
import { SessionSummary } from "@/components/live-sessions/session-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/live-sessions/cash-game/$sessionId")({
	component: CashGameSessionPage,
});

const EVENT_TYPE_LABELS: Record<string, string> = {
	cash_game_buy_in: "Buy-in",
	cash_game_stack_record: "Stack Record",
	cash_out: "Cash Out",
	player_join: "Player Join",
	player_leave: "Player Leave",
};

function formatEventLabel(eventType: string): string {
	return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

function formatTimestamp(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	const h = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}/${m}/${d} ${h}:${min}`;
}

function formatPayloadSummary(
	eventType: string,
	payload: unknown
): string | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const p = payload as Record<string, unknown>;

	if (eventType === "cash_game_buy_in" && typeof p.amount === "number") {
		return `Amount: ${p.amount.toLocaleString()}`;
	}
	if (
		eventType === "cash_game_stack_record" &&
		typeof p.stackAmount === "number"
	) {
		const parts = [`Stack: ${p.stackAmount.toLocaleString()}`];
		if (p.addon && typeof p.addon === "object") {
			const addon = p.addon as Record<string, unknown>;
			if (typeof addon.amount === "number") {
				parts.push(`Addon: ${addon.amount.toLocaleString()}`);
			}
		}
		if (Array.isArray(p.allIns) && p.allIns.length > 0) {
			parts.push(`${p.allIns.length} all-in(s)`);
		}
		return parts.join(" · ");
	}
	if (eventType === "cash_out" && typeof p.amount === "number") {
		return `Amount: ${p.amount.toLocaleString()}`;
	}
	return null;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
	active:
		"border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
	completed: "border-border bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
	active: "Active",
	completed: "Completed",
};

function CashGameSessionPage() {
	const { sessionId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);

	const sessionQuery = useQuery(
		trpc.liveCashGameSession.getById.queryOptions({ id: sessionId })
	);
	const session = sessionQuery.data;

	const eventsQuery = useQuery(
		trpc.sessionEvent.list.queryOptions({ liveCashGameSessionId: sessionId })
	);
	const events = eventsQuery.data ?? [];

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
			await navigate({ to: "/live-sessions" });
		},
	});

	const discardMutation = useMutation({
		mutationFn: () =>
			trpcClient.liveCashGameSession.discard.mutate({ id: sessionId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			await navigate({ to: "/live-sessions" });
		},
	});

	const handleStack = (values: {
		addon: { amount: number } | null;
		allIns: Array<{
			potSize: number;
			trials: number;
			equity: number;
			wins: number;
		}>;
		stackAmount: number;
	}) => {
		stackMutation.mutate(values);
	};

	const handleComplete = (values: { cashOut: number }) => {
		completeMutation.mutate(values);
	};

	const handleDiscard = () => {
		discardMutation.mutate();
	};

	if (!session) {
		return (
			<div className="p-4 md:p-6">
				<p className="text-muted-foreground">Loading session...</p>
			</div>
		);
	}

	const isActive = session.status === "active";
	const isCompleted = session.status === "completed";

	return (
		<div className="p-4 md:p-6">
			{/* Header */}
			<div className="mb-4 flex items-center gap-3">
				<Button
					onClick={() => navigate({ to: "/live-sessions" })}
					size="sm"
					variant="ghost"
				>
					<IconChevronLeft size={16} />
					Back
				</Button>
			</div>

			<div className="mb-6 flex flex-col gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="font-bold text-2xl">Cash Game</h1>
					<Badge
						className={STATUS_BADGE_CLASS[session.status] ?? ""}
						variant="outline"
					>
						{STATUS_LABEL[session.status] ?? session.status}
					</Badge>
				</div>

				{session.memo && (
					<p className="text-muted-foreground text-sm">{session.memo}</p>
				)}

				{/* Action buttons */}
				{isActive && (
					<div className="flex flex-wrap gap-2">
						<Button onClick={() => setIsCompleteOpen(true)} variant="default">
							<IconCircleCheck size={16} />
							Complete Session
						</Button>
						<Button
							onClick={() => setIsDiscardOpen(true)}
							variant="destructive"
						>
							<IconTrash size={16} />
							Discard
						</Button>
					</div>
				)}
			</div>

			{/* Summary */}
			<section className="mb-6">
				<h2 className="mb-3 font-semibold text-lg">Summary</h2>
				<SessionSummary summary={session.summary} />
			</section>

			{/* Recording forms – only for active sessions */}
			{isActive && (
				<section className="mb-6">
					<h2 className="mb-3 font-semibold text-lg">Record Stack</h2>
					<Card>
						<CardContent className="pt-4">
							<CashGameStackForm
								isLoading={stackMutation.isPending}
								onSubmit={handleStack}
							/>
						</CardContent>
					</Card>
				</section>
			)}

			{/* Event list */}
			<section className="mb-6">
				<h2 className="mb-3 font-semibold text-lg">Events</h2>
				{events.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No events recorded yet.
					</p>
				) : (
					<div className="flex flex-col gap-2">
						{events.map((event) => {
							const payloadSummary = formatPayloadSummary(
								event.eventType,
								event.payload
							);
							return (
								<Card key={event.id} size="sm">
									<CardContent className="flex flex-col gap-1 py-3">
										<div className="flex items-center justify-between gap-2">
											<span className="font-medium text-sm">
												{formatEventLabel(event.eventType)}
											</span>
											<span className="text-muted-foreground text-xs">
												{formatTimestamp(event.occurredAt)}
											</span>
										</div>
										{payloadSummary && (
											<p className="text-muted-foreground text-xs">
												{payloadSummary}
											</p>
										)}
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</section>

			{/* Complete dialog */}
			<ResponsiveDialog
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Session"
			>
				<CashGameCompleteForm
					isLoading={completeMutation.isPending}
					onSubmit={handleComplete}
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
							This will permanently delete this session and all its events. This
							action cannot be undone.
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
							onClick={handleDiscard}
							type="button"
							variant="destructive"
						>
							{discardMutation.isPending ? "Discarding..." : "Discard Session"}
						</Button>
					</div>
				</div>
			</ResponsiveDialog>

			{/* Completed state note */}
			{isCompleted && (
				<div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
					<p className="text-muted-foreground text-sm">
						This session has been completed and saved to your session history.
					</p>
					<div className="mt-3">
						<Button
							disabled={reopenMutation.isPending}
							onClick={() => reopenMutation.mutate()}
							variant="outline"
						>
							{reopenMutation.isPending ? "Reopening..." : "Reopen Session"}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
