import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StackRecordEditor } from "@/components/live-sessions/stack-record-editor";
import { TournamentStackRecordEditor } from "@/components/live-tournament/tournament-stack-record-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute(
	"/live-sessions/cash-game/$sessionId/events"
)({
	component: CashGameEventsPage,
});

const EVENT_TYPE_LABELS: Record<string, string> = {
	chip_add: "Chip Add",
	stack_record: "Stack Record",
	player_join: "Player Join",
	player_leave: "Player Leave",
	session_start: "Session Start",
	session_end: "Session End",
	tournament_stack_record: "Stack Record",
	tournament_result: "Tournament Result",
};

const LIFECYCLE_EVENTS = new Set(["session_start", "session_end"]);

function formatEventLabel(eventType: string): string {
	return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

function formatTime(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toTimeInputValue(value: string | Date): string {
	return formatTime(value);
}

function applyTimeToDate(original: string | Date, timeStr: string): Date {
	const date = new Date(typeof original === "string" ? original : original);
	const [h, m] = timeStr.split(":").map(Number);
	date.setHours(h ?? 0, m ?? 0, 0, 0);
	return date;
}

function formatPayloadSummary(
	eventType: string,
	payload: unknown
): string | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const p = payload as Record<string, unknown>;
	if (eventType === "chip_add" && typeof p.amount === "number") {
		return `Amount: ${p.amount.toLocaleString()}`;
	}
	if (eventType === "stack_record" && typeof p.stackAmount === "number") {
		const parts = [`Stack: ${p.stackAmount.toLocaleString()}`];
		if (Array.isArray(p.allIns) && p.allIns.length > 0) {
			parts.push(`${p.allIns.length} all-in(s)`);
		}
		return parts.join(" · ");
	}
	if (
		eventType === "tournament_stack_record" &&
		typeof p.stackAmount === "number"
	) {
		const parts = [`Stack: ${p.stackAmount.toLocaleString()}`];
		if (typeof p.remainingPlayers === "number") {
			parts.push(`${p.remainingPlayers} left`);
		}
		if (p.rebuy && typeof p.rebuy === "object") {
			parts.push("Rebuy");
		}
		if (p.addon && typeof p.addon === "object") {
			parts.push("Addon");
		}
		return parts.join(" · ");
	}
	if (eventType === "tournament_result") {
		const parts: string[] = [];
		if (typeof p.placement === "number") {
			parts.push(`#${p.placement}`);
		}
		if (typeof p.totalEntries === "number") {
			parts.push(`/${p.totalEntries}`);
		}
		if (typeof p.prizeMoney === "number" && p.prizeMoney > 0) {
			parts.push(`Prize: ${p.prizeMoney.toLocaleString()}`);
		}
		return parts.join(" ") || null;
	}
	return null;
}

interface SessionEvent {
	eventType: string;
	id: string;
	occurredAt: string | Date;
	payload: unknown;
}

function AllInsDetail({ allIns }: { allIns: unknown[] }) {
	return (
		<ul className="mt-1 flex flex-col gap-0.5">
			{allIns.map((item, i) => {
				if (!item || typeof item !== "object") {
					return null;
				}
				const ai = item as Record<string, unknown>;
				const parts: string[] = [];
				if (typeof ai.potSize === "number") {
					parts.push(`Pot: ${ai.potSize.toLocaleString()}`);
				}
				if (typeof ai.equity === "number") {
					parts.push(`Equity: ${ai.equity}%`);
				}
				if (typeof ai.wins === "number") {
					parts.push(`Wins: ${ai.wins}`);
				}
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: static list from payload
					<li className="text-muted-foreground text-xs" key={i}>
						All-in {i + 1}: {parts.join(", ")}
					</li>
				);
			})}
		</ul>
	);
}

function TournamentStackDetail({
	payload,
}: {
	payload: Record<string, unknown>;
}) {
	const parts: string[] = [];
	if (payload.rebuy && typeof payload.rebuy === "object") {
		const r = payload.rebuy as Record<string, unknown>;
		parts.push(`Rebuy: cost ${r.cost}, chips ${r.chips}`);
	}
	if (payload.addon && typeof payload.addon === "object") {
		const a = payload.addon as Record<string, unknown>;
		parts.push(`Addon: cost ${a.cost}, chips ${a.chips}`);
	}
	if (parts.length === 0) {
		return null;
	}
	return (
		<ul className="mt-1 flex flex-col gap-0.5">
			{parts.map((part) => (
				<li className="text-muted-foreground text-xs" key={part}>
					{part}
				</li>
			))}
		</ul>
	);
}

function EventDetail({
	eventType,
	payload,
}: {
	eventType: string;
	payload: unknown;
}) {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const p = payload as Record<string, unknown>;
	if (eventType === "stack_record") {
		const hasAllIns: boolean = Array.isArray(p.allIns) && p.allIns.length > 0;
		if (!hasAllIns) {
			return null;
		}
		return (
			<div className="mt-1">
				<AllInsDetail allIns={p.allIns as unknown[]} />
			</div>
		);
	}
	if (eventType === "tournament_stack_record") {
		return (
			<div className="mt-1">
				<TournamentStackDetail payload={p} />
			</div>
		);
	}
	return null;
}

function validateTime(
	timeStr: string,
	original: string | Date,
	minTime: Date | null,
	maxTime: Date | null
): string | null {
	const newDate = applyTimeToDate(original, timeStr);
	if (minTime && newDate.getTime() < minTime.getTime()) {
		return `Must be after ${formatTime(minTime)}`;
	}
	if (maxTime && newDate.getTime() > maxTime.getTime()) {
		return `Must be before ${formatTime(maxTime)}`;
	}
	return null;
}

function TimeOnlyEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (occurredAt: number) => void;
}) {
	const [time, setTime] = useState(toTimeInputValue(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-time">Time</Label>
				<Input
					id="edit-time"
					onChange={(e) => setTime(e.target.value)}
					type="time"
					value={time}
				/>
				{error && <p className="text-destructive text-xs">{error}</p>}
			</div>
			<Button
				disabled={isLoading || error !== null}
				onClick={() => {
					const newDate = applyTimeToDate(event.occurredAt, time);
					onSubmit(Math.floor(newDate.getTime() / 1000));
				}}
				type="button"
			>
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</div>
	);
}

function AmountEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onDelete: handleDelete,
	onSubmit,
}: {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onDelete: () => void;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}) {
	const p = (event.payload ?? {}) as Record<string, unknown>;
	const [amount, setAmount] = useState(String(p.amount ?? 0));
	const [time, setTime] = useState(toTimeInputValue(event.occurredAt));
	const timeError = validateTime(time, event.occurredAt, minTime, maxTime);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-time">Time</Label>
				<Input
					id="edit-time"
					onChange={(e) => setTime(e.target.value)}
					type="time"
					value={time}
				/>
				{timeError && <p className="text-destructive text-xs">{timeError}</p>}
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-amount">Amount</Label>
				<Input
					id="edit-amount"
					inputMode="numeric"
					min={0}
					onChange={(e) => setAmount(e.target.value)}
					type="number"
					value={amount}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Button
					disabled={isLoading || timeError !== null}
					onClick={() => {
						const newDate = applyTimeToDate(event.occurredAt, time);
						onSubmit(
							{ amount: Number(amount) },
							Math.floor(newDate.getTime() / 1000)
						);
					}}
					type="button"
				>
					{isLoading ? "Saving..." : "Save"}
				</Button>
				<Button onClick={handleDelete} type="button" variant="destructive">
					Delete
				</Button>
			</div>
		</div>
	);
}

function getTimeBounds(
	events: SessionEvent[],
	targetId: string
): { minTime: Date | null; maxTime: Date | null } {
	const idx = events.findIndex((e) => e.id === targetId);
	const prev = idx > 0 ? events[idx - 1] : null;
	const next = idx < events.length - 1 ? events[idx + 1] : null;
	return {
		minTime: prev ? new Date(prev.occurredAt as string) : null,
		maxTime: next ? new Date(next.occurredAt as string) : null,
	};
}

function TournamentResultEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onDelete: handleDelete,
	onSubmit,
}: {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onDelete: () => void;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}) {
	const p = (event.payload ?? {}) as Record<string, unknown>;
	const [placement, setPlacement] = useState(String(p.placement ?? 1));
	const [totalEntries, setTotalEntries] = useState(String(p.totalEntries ?? 1));
	const [prizeMoney, setPrizeMoney] = useState(String(p.prizeMoney ?? 0));
	const [bountyPrizes, setBountyPrizes] = useState(
		p.bountyPrizes !== null && p.bountyPrizes !== undefined
			? String(p.bountyPrizes)
			: ""
	);
	const [time, setTime] = useState(toTimeInputValue(event.occurredAt));
	const timeError = validateTime(time, event.occurredAt, minTime, maxTime);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-time">Time</Label>
				<Input
					id="edit-time"
					onChange={(e) => setTime(e.target.value)}
					type="time"
					value={time}
				/>
				{timeError && <p className="text-destructive text-xs">{timeError}</p>}
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-placement">Placement</Label>
				<Input
					id="edit-placement"
					inputMode="numeric"
					min={1}
					onChange={(e) => setPlacement(e.target.value)}
					required
					type="number"
					value={placement}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-totalEntries">Total Entries</Label>
				<Input
					id="edit-totalEntries"
					inputMode="numeric"
					min={1}
					onChange={(e) => setTotalEntries(e.target.value)}
					required
					type="number"
					value={totalEntries}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-prizeMoney">Prize Money</Label>
				<Input
					id="edit-prizeMoney"
					inputMode="numeric"
					min={0}
					onChange={(e) => setPrizeMoney(e.target.value)}
					required
					type="number"
					value={prizeMoney}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-bountyPrizes">Bounty Prizes</Label>
				<Input
					id="edit-bountyPrizes"
					inputMode="numeric"
					min={0}
					onChange={(e) => setBountyPrizes(e.target.value)}
					type="number"
					value={bountyPrizes}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Button
					disabled={isLoading || timeError !== null}
					onClick={() => {
						const newDate = applyTimeToDate(event.occurredAt, time);
						onSubmit(
							{
								placement: Number(placement),
								totalEntries: Number(totalEntries),
								prizeMoney: Number(prizeMoney),
								bountyPrizes: bountyPrizes ? Number(bountyPrizes) : null,
							},
							Math.floor(newDate.getTime() / 1000)
						);
					}}
					type="button"
				>
					{isLoading ? "Saving..." : "Save"}
				</Button>
				<Button onClick={handleDelete} type="button" variant="destructive">
					Delete
				</Button>
			</div>
		</div>
	);
}

function EventEditor({
	editEvent,
	isLoading,
	timeBounds,
	onDelete,
	onTimeUpdate,
	onUpdate,
}: {
	editEvent: SessionEvent;
	isLoading: boolean;
	timeBounds: { minTime: Date | null; maxTime: Date | null };
	onDelete: () => void;
	onTimeUpdate: (occurredAt: number) => void;
	onUpdate: (payload: unknown, occurredAt?: number) => void;
}) {
	if (LIFECYCLE_EVENTS.has(editEvent.eventType)) {
		return (
			<TimeOnlyEditor
				event={editEvent}
				isLoading={isLoading}
				maxTime={timeBounds.maxTime}
				minTime={timeBounds.minTime}
				onSubmit={onTimeUpdate}
			/>
		);
	}

	if (editEvent.eventType === "stack_record") {
		return (
			<StackRecordEditor
				initialOccurredAt={editEvent.occurredAt}
				initialPayload={{
					stackAmount:
						(editEvent.payload as { stackAmount?: number })?.stackAmount ?? 0,
					allIns: Array.isArray(
						(editEvent.payload as { allIns?: unknown })?.allIns
					)
						? ((editEvent.payload as { allIns: unknown[] }).allIns as Array<{
								equity: number;
								potSize: number;
								trials: number;
								wins: number;
							}>)
						: [],
				}}
				isLoading={isLoading}
				maxTime={timeBounds.maxTime}
				minTime={timeBounds.minTime}
				onDelete={onDelete}
				onSubmit={(payload, occurredAt) => onUpdate(payload, occurredAt)}
			/>
		);
	}

	if (editEvent.eventType === "tournament_stack_record") {
		const p = (editEvent.payload ?? {}) as Record<string, unknown>;
		return (
			<TournamentStackRecordEditor
				initialOccurredAt={editEvent.occurredAt}
				initialPayload={{
					stackAmount: typeof p.stackAmount === "number" ? p.stackAmount : 0,
					remainingPlayers:
						typeof p.remainingPlayers === "number" ? p.remainingPlayers : null,
					averageStack:
						typeof p.averageStack === "number" ? p.averageStack : null,
					rebuy:
						p.rebuy && typeof p.rebuy === "object"
							? (p.rebuy as { cost: number; chips: number })
							: null,
					addon:
						p.addon && typeof p.addon === "object"
							? (p.addon as { cost: number; chips: number })
							: null,
				}}
				isLoading={isLoading}
				maxTime={timeBounds.maxTime}
				minTime={timeBounds.minTime}
				onDelete={onDelete}
				onSubmit={(payload, occurredAt) => onUpdate(payload, occurredAt)}
			/>
		);
	}

	if (editEvent.eventType === "tournament_result") {
		return (
			<TournamentResultEditor
				event={editEvent}
				isLoading={isLoading}
				maxTime={timeBounds.maxTime}
				minTime={timeBounds.minTime}
				onDelete={onDelete}
				onSubmit={onUpdate}
			/>
		);
	}

	return (
		<AmountEditor
			event={editEvent}
			isLoading={isLoading}
			maxTime={timeBounds.maxTime}
			minTime={timeBounds.minTime}
			onDelete={onDelete}
			onSubmit={onUpdate}
		/>
	);
}

function CashGameEventsPage() {
	const { sessionId } = Route.useParams();
	const queryClient = useQueryClient();

	const [editEvent, setEditEvent] = useState<SessionEvent | null>(null);

	const eventsQuery = useQuery(
		trpc.sessionEvent.list.queryOptions({ liveCashGameSessionId: sessionId })
	);
	const events = (eventsQuery.data ?? []) as SessionEvent[];

	const eventsKey = trpc.sessionEvent.list.queryOptions({
		liveCashGameSessionId: sessionId,
	}).queryKey;
	const sessionKey = trpc.liveCashGameSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;

	const invalidateAll = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: eventsKey }),
			queryClient.invalidateQueries({ queryKey: sessionKey }),
		]);
	};

	const updateMutation = useMutation({
		mutationFn: (args: {
			id: string;
			occurredAt?: number;
			payload?: unknown;
		}) => trpcClient.sessionEvent.update.mutate(args),
		onSuccess: async () => {
			await invalidateAll();
			setEditEvent(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.sessionEvent.delete.mutate({ id }),
		onSuccess: async () => {
			await invalidateAll();
			setEditEvent(null);
		},
	});

	const timeBounds = editEvent
		? getTimeBounds(events, editEvent.id)
		: { minTime: null, maxTime: null };

	return (
		<div className="p-4 md:p-6">
			<div className="mb-4 flex flex-wrap items-center gap-2">
				<h1 className="font-bold text-2xl">Events</h1>
				<Badge variant="outline">{events.length}</Badge>
			</div>

			{events.length === 0 ? (
				<p className="text-muted-foreground text-sm">No events recorded yet.</p>
			) : (
				<div className="relative">
					<div className="absolute top-0 bottom-0 left-[52px] w-px bg-border" />
					{events.map((event) => {
						const payloadSummary = formatPayloadSummary(
							event.eventType,
							event.payload
						);
						const isLifecycle = LIFECYCLE_EVENTS.has(event.eventType);
						return (
							<div className="relative flex gap-3 pb-4" key={event.id}>
								<div className="w-[44px] shrink-0 pt-0.5 text-right text-muted-foreground text-xs">
									{formatTime(event.occurredAt)}
								</div>
								<div className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-2">
										<div>
											<span className="font-medium text-sm">
												{formatEventLabel(event.eventType)}
											</span>
											{payloadSummary && (
												<p className="mt-0.5 text-muted-foreground text-xs">
													{payloadSummary}
												</p>
											)}
											<EventDetail
												eventType={event.eventType}
												payload={event.payload}
											/>
										</div>
										<div className="flex shrink-0 gap-1">
											<Button
												onClick={() => setEditEvent(event)}
												size="icon-xs"
												variant="ghost"
											>
												<IconPencil size={14} />
											</Button>
											{!isLifecycle && (
												<Button
													onClick={() => deleteMutation.mutate(event.id)}
													size="icon-xs"
													variant="ghost"
												>
													<IconTrash size={14} />
												</Button>
											)}
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditEvent(null);
					}
				}}
				open={editEvent !== null}
				title={`Edit ${editEvent ? formatEventLabel(editEvent.eventType) : ""}`}
			>
				{editEvent && (
					<EventEditor
						editEvent={editEvent}
						isLoading={updateMutation.isPending}
						onDelete={() => deleteMutation.mutate(editEvent.id)}
						onTimeUpdate={(occurredAt) =>
							updateMutation.mutate({ id: editEvent.id, occurredAt })
						}
						onUpdate={(payload, occurredAt) =>
							updateMutation.mutate({
								id: editEvent.id,
								payload,
								occurredAt,
							})
						}
						timeBounds={timeBounds}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}
