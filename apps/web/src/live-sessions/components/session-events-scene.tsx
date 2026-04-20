import { IconArrowLeft, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EventEditor } from "@/live-sessions/components/event-editors/event-editor";
import { toTimeInputValue } from "@/live-sessions/components/stack-editor-time";
import {
	type SessionEvent,
	useSessionEvents,
} from "@/live-sessions/hooks/use-session-events";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

const EVENT_TYPE_LABELS: Record<string, string> = {
	chips_add_remove: "Chips Add/Remove",
	update_stack: "Stack Update",
	all_in: "All-in",
	purchase_chips: "Purchase Chips",
	update_tournament_info: "Tournament Info",
	memo: "Memo",
	session_pause: "Session Pause",
	session_resume: "Session Resume",
	session_start: "Session Start",
	session_end: "Session End",
	player_join: "Player Join",
	player_leave: "Player Leave",
};

// Events that cannot be deleted (lifecycle only)
const LIFECYCLE_EVENTS = new Set(["session_start", "session_end"]);

type SessionType = "cash_game" | "tournament";

interface SessionEventsSceneProps {
	backTo?: string;
	emptySessionMessage?: string;
	refetchInterval?: number;
	sessionId: string;
	sessionLoading?: boolean;
	sessionType: SessionType;
}

function formatEventLabel(eventType: string) {
	return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

function formatChipsAddRemoveSummary(p: Record<string, unknown>) {
	const amount = typeof p.amount === "number" ? p.amount : null;
	let type: string | null = null;
	if (p.type === "add") {
		type = "Add";
	} else if (p.type === "remove") {
		type = "Remove";
	}
	if (amount !== null && type !== null) {
		return `${type}: ${amount.toLocaleString()}`;
	}
	return null;
}

function formatAllInSummary(p: Record<string, unknown>) {
	const parts: string[] = [];
	if (typeof p.potSize === "number") {
		parts.push(`Pot: ${p.potSize.toLocaleString()}`);
	}
	if (typeof p.equity === "number") {
		parts.push(`Equity: ${p.equity}%`);
	}
	return parts.length > 0 ? parts.join(" · ") : null;
}

function formatSessionEndSummary(p: Record<string, unknown>) {
	if (typeof p.cashOutAmount === "number") {
		return `Cash-out: ${p.cashOutAmount.toLocaleString()}`;
	}
	if (p.beforeDeadline === true) {
		return "- / - entries";
	}
	if (typeof p.placement === "number" && typeof p.totalEntries === "number") {
		return `#${p.placement} / ${p.totalEntries}`;
	}
	if (typeof p.placement === "number") {
		return `#${p.placement}`;
	}
	return null;
}

function formatPurchaseChipsSummary(p: Record<string, unknown>) {
	const name = typeof p.name === "string" ? p.name : null;
	const cost = typeof p.cost === "number" ? p.cost : null;
	return name !== null && cost !== null
		? `${name}: ${cost.toLocaleString()}`
		: null;
}

function formatUpdateTournamentInfoSummary(p: Record<string, unknown>) {
	if (typeof p.remainingPlayers === "number") {
		return `Remaining: ${p.remainingPlayers}`;
	}
	if (typeof p.totalEntries === "number") {
		return `Entries: ${p.totalEntries}`;
	}
	return null;
}

function formatMemoSummary(p: Record<string, unknown>) {
	if (typeof p.text !== "string") {
		return null;
	}
	const text = p.text.trim();
	return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

type PayloadSummarizer = (p: Record<string, unknown>) => string | null;

const PAYLOAD_SUMMARIZERS: Record<string, PayloadSummarizer> = {
	chips_add_remove: formatChipsAddRemoveSummary,
	update_stack: (p) =>
		typeof p.stackAmount === "number"
			? `Stack: ${p.stackAmount.toLocaleString()}`
			: null,
	all_in: formatAllInSummary,
	purchase_chips: formatPurchaseChipsSummary,
	update_tournament_info: formatUpdateTournamentInfoSummary,
	memo: formatMemoSummary,
	session_start: (p) =>
		typeof p.buyInAmount === "number"
			? `Buy-in: ${p.buyInAmount.toLocaleString()}`
			: null,
	session_end: formatSessionEndSummary,
	player_join: (p) => (p.isHero === true ? "Hero" : null),
	player_leave: (p) => (p.isHero === true ? "Hero" : null),
};

function formatPayloadSummary(eventType: string, payload: unknown) {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const summarizer = PAYLOAD_SUMMARIZERS[eventType];
	return summarizer ? summarizer(payload as Record<string, unknown>) : null;
}

function getTimeBounds(
	events: SessionEvent[],
	targetId: string
): { minTime: Date | null; maxTime: Date | null } {
	const index = events.findIndex((event) => event.id === targetId);
	const previous = index > 0 ? events[index - 1] : null;
	const next = index < events.length - 1 ? events[index + 1] : null;
	return {
		minTime: previous ? new Date(previous.occurredAt) : null,
		maxTime: next ? new Date(next.occurredAt) : null,
	};
}

type EventGroup =
	| { type: "single"; event: SessionEvent }
	| { type: "player_group"; events: SessionEvent[] };

function groupEventsForDisplay(events: SessionEvent[]): EventGroup[] {
	const groups: EventGroup[] = [];
	let i = 0;
	while (i < events.length) {
		const event = events[i];
		if (
			event.eventType === "player_join" ||
			event.eventType === "player_leave"
		) {
			const clusterStart = i;
			while (
				i < events.length &&
				(events[i].eventType === "player_join" ||
					events[i].eventType === "player_leave")
			) {
				i++;
			}
			const cluster = events.slice(clusterStart, i);
			if (cluster.length >= 2) {
				groups.push({ type: "player_group", events: cluster });
			} else {
				groups.push({ type: "single", event: cluster[0] });
			}
		} else {
			groups.push({ type: "single", event });
			i++;
		}
	}
	return groups;
}

export function SessionEventsScene({
	backTo,
	emptySessionMessage = "No active session",
	refetchInterval,
	sessionId,
	sessionLoading = false,
	sessionType,
}: SessionEventsSceneProps) {
	const [editEvent, setEditEvent] = useState<SessionEvent | null>(null);
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);

	const {
		events,
		update,
		delete: deleteEvent,
		isUpdatePending,
	} = useSessionEvents({
		sessionId,
		sessionType,
		refetchInterval,
	});

	const groups = useMemo(() => groupEventsForDisplay(events), [events]);

	if (sessionLoading) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}
	if (!sessionId) {
		return (
			<div className="flex h-[100dvh] items-center justify-center pb-16">
				<p className="text-muted-foreground">{emptySessionMessage}</p>
			</div>
		);
	}
	const timeBounds = editEvent
		? getTimeBounds(events, editEvent.id)
		: { minTime: null, maxTime: null };

	function renderEventRow(event: SessionEvent) {
		const payloadSummary = formatPayloadSummary(event.eventType, event.payload);
		const isLifecycle = LIFECYCLE_EVENTS.has(event.eventType);
		const canDelete = !isLifecycle;
		return (
			<div className="relative flex gap-3 pb-4" key={event.id}>
				<div className="w-[44px] shrink-0 pt-0.5 text-right text-muted-foreground text-xs">
					{toTimeInputValue(event.occurredAt)}
				</div>
				<div className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<div>
							<span className="font-medium text-sm">
								{formatEventLabel(event.eventType)}
							</span>
							{payloadSummary ? (
								<p className="mt-0.5 text-muted-foreground text-xs">
									{payloadSummary}
								</p>
							) : null}
						</div>
						<div className="flex shrink-0 items-center gap-1">
							{canDelete && confirmingDeleteId === event.id ? (
								<>
									<span className="text-destructive text-xs">Delete?</span>
									<Button
										aria-label="Confirm delete"
										className="text-destructive hover:text-destructive"
										onClick={() => {
											deleteEvent(event.id);
											setConfirmingDeleteId(null);
										}}
										size="icon-xs"
										type="button"
										variant="ghost"
									>
										<IconTrash size={14} />
									</Button>
									<Button
										aria-label="Cancel delete"
										onClick={() => setConfirmingDeleteId(null)}
										size="icon-xs"
										type="button"
										variant="ghost"
									>
										<IconX size={14} />
									</Button>
								</>
							) : (
								<>
									<Button
										aria-label={`Edit ${formatEventLabel(event.eventType)}`}
										onClick={() => setEditEvent(event)}
										size="icon-xs"
										variant="ghost"
									>
										<IconPencil size={14} />
									</Button>
									{canDelete && (
										<Button
											aria-label={`Delete ${formatEventLabel(event.eventType)}`}
											className="text-destructive hover:text-destructive"
											onClick={() => setConfirmingDeleteId(event.id)}
											size="icon-xs"
											type="button"
											variant="ghost"
										>
											<IconTrash size={14} />
										</Button>
									)}
								</>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 md:p-6">
			<div className="mb-4 flex flex-wrap items-center gap-2">
				{backTo && (
					<Button asChild size="sm" variant="ghost" className="-ml-2 mr-1">
						<Link to={backTo}>
							<IconArrowLeft size={16} />
							Back
						</Link>
					</Button>
				)}
				<h1 className="font-bold text-2xl">Events</h1>
				<Badge variant="outline">{events.length}</Badge>
			</div>
			{events.length === 0 ? (
				<EmptyState
					className="border-none bg-transparent px-0 py-8"
					description="Once play starts, session events will appear here in timeline order."
					heading="No events recorded yet."
				/>
			) : (
				<div className="relative">
					<div className="absolute top-0 bottom-0 left-[52px] w-px bg-border" />
					{groups.map((group) => {
						if (group.type === "single") {
							return renderEventRow(group.event);
						}
						const first = group.events[0];
						const last = group.events.at(-1);
						const timeRange = `${toTimeInputValue(first.occurredAt)}–${toTimeInputValue(last?.occurredAt ?? first.occurredAt)}`;
						const summary = `${group.events.length} player changes`;
						return (
							<Accordion className="relative" key={first.id} type="multiple">
								<AccordionItem className="border-b-0" value={first.id}>
									<div className="relative flex gap-3">
										<div className="w-[44px] shrink-0 pt-0.5 text-right text-muted-foreground text-xs">
											{toTimeInputValue(first.occurredAt)}
										</div>
										<div className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
										<div className="min-w-0 flex-1">
											<AccordionTrigger className="py-0 pb-4">
												<span className="font-medium text-sm">
													{summary} · {timeRange}
												</span>
											</AccordionTrigger>
										</div>
									</div>
									<AccordionContent className="pb-0">
										{group.events.map((event) => renderEventRow(event))}
									</AccordionContent>
								</AccordionItem>
							</Accordion>
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
				{editEvent ? (
					<EventEditor
						event={editEvent}
						isLoading={isUpdatePending}
						maxTime={timeBounds.maxTime}
						minTime={timeBounds.minTime}
						onSubmit={(payload, occurredAt) =>
							update({
								id: editEvent.id,
								payload,
								occurredAt,
							}).then(() => setEditEvent(null))
						}
						onTimeUpdate={(occurredAt) =>
							update({ id: editEvent.id, occurredAt }).then(() =>
								setEditEvent(null)
							)
						}
						sessionType={sessionType}
					/>
				) : null}
			</ResponsiveDialog>
		</div>
	);
}
