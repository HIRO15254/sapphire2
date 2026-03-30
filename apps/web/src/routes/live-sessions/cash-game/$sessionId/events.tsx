import { IconChevronLeft, IconPencil, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute(
	"/live-sessions/cash-game/$sessionId/events"
)({
	component: CashGameEventsPage,
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

function formatTime(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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

	if (eventType === "cash_game_stack_record") {
		const hasAddon: boolean =
			!!p.addon &&
			typeof p.addon === "object" &&
			typeof (p.addon as Record<string, unknown>).amount === "number";
		const hasAllIns: boolean = Array.isArray(p.allIns) && p.allIns.length > 0;

		if (!(hasAddon || hasAllIns)) {
			return null;
		}

		return (
			<div className="mt-1">
				{hasAddon && (
					<p className="text-muted-foreground text-xs">
						Addon:{" "}
						{(
							(p.addon as Record<string, unknown>).amount as number
						).toLocaleString()}
					</p>
				)}
				{hasAllIns && <AllInsDetail allIns={p.allIns as unknown[]} />}
			</div>
		);
	}

	return null;
}

function EditDialog({
	event,
	onClose,
	onSuccess,
}: {
	event: SessionEvent;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [value, setValue] = useState(JSON.stringify(event.payload, null, 2));
	const [parseError, setParseError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: (parsed: unknown) =>
			trpcClient.sessionEvent.update.mutate({ id: event.id, payload: parsed }),
		onSuccess: () => {
			onSuccess();
			onClose();
		},
	});

	const handleSave = () => {
		setParseError(null);
		let parsed: unknown;
		try {
			parsed = JSON.parse(value);
		} catch (err) {
			setParseError(err instanceof Error ? err.message : "Invalid JSON");
			return;
		}
		mutation.mutate(parsed);
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<span className="font-medium text-sm">Event type</span>
				<span className="text-muted-foreground text-sm">
					{formatEventLabel(event.eventType)}
				</span>
			</div>
			<div className="flex flex-col gap-1.5">
				<label className="font-medium text-sm" htmlFor="event-payload">
					Payload (JSON)
				</label>
				<textarea
					className="h-48 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					id="event-payload"
					onChange={(e) => setValue(e.target.value)}
					value={value}
				/>
				{parseError && <p className="text-destructive text-xs">{parseError}</p>}
			</div>
			<div className="flex justify-end gap-2">
				<Button onClick={onClose} type="button" variant="outline">
					Cancel
				</Button>
				<Button
					disabled={mutation.isPending}
					onClick={handleSave}
					type="button"
				>
					{mutation.isPending ? "Saving..." : "Save"}
				</Button>
			</div>
		</div>
	);
}

function DeleteDialog({
	event,
	onClose,
	onSuccess,
}: {
	event: SessionEvent;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const mutation = useMutation({
		mutationFn: () => trpcClient.sessionEvent.delete.mutate({ id: event.id }),
		onSuccess: () => {
			onSuccess();
			onClose();
		},
	});

	return (
		<div className="flex flex-col gap-4">
			<p className="text-sm">
				Delete this event? This action cannot be undone.
			</p>
			<div className="flex justify-end gap-2">
				<Button onClick={onClose} type="button" variant="outline">
					Cancel
				</Button>
				<Button
					disabled={mutation.isPending}
					onClick={() => mutation.mutate()}
					type="button"
					variant="destructive"
				>
					{mutation.isPending ? "Deleting..." : "Delete"}
				</Button>
			</div>
		</div>
	);
}

function CashGameEventsPage() {
	const { sessionId } = Route.useParams();
	const queryClient = useQueryClient();

	const [editEvent, setEditEvent] = useState<SessionEvent | null>(null);
	const [deleteEvent, setDeleteEvent] = useState<SessionEvent | null>(null);

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

	return (
		<div className="p-4 md:p-6">
			{/* Header */}
			<div className="mb-4 flex items-center gap-3">
				<Button asChild size="sm" variant="ghost">
					<Link params={{ sessionId }} to="/live-sessions/cash-game/$sessionId">
						<IconChevronLeft size={16} />
						Back
					</Link>
				</Button>
			</div>

			<div className="mb-6 flex flex-wrap items-center gap-2">
				<h1 className="font-bold text-2xl">Events</h1>
				<Badge variant="outline">{events.length}</Badge>
			</div>

			{events.length === 0 ? (
				<p className="text-muted-foreground text-sm">No events recorded yet.</p>
			) : (
				<div className="relative">
					{/* Vertical line */}
					<div className="absolute top-0 bottom-0 left-[52px] w-px bg-border" />

					{events.map((event) => {
						const payloadSummary = formatPayloadSummary(
							event.eventType,
							event.payload
						);
						return (
							<div className="relative flex gap-3 pb-4" key={event.id}>
								{/* Time column */}
								<div className="w-[44px] shrink-0 pt-0.5 text-right text-muted-foreground text-xs">
									{formatTime(event.occurredAt)}
								</div>

								{/* Dot */}
								<div className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />

								{/* Content */}
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
											<Button
												onClick={() => setDeleteEvent(event)}
												size="icon-xs"
												variant="ghost"
											>
												<IconTrash size={14} />
											</Button>
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Edit dialog */}
			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditEvent(null);
					}
				}}
				open={editEvent !== null}
				title="Edit Event"
			>
				{editEvent && (
					<EditDialog
						event={editEvent}
						onClose={() => setEditEvent(null)}
						onSuccess={invalidateAll}
					/>
				)}
			</ResponsiveDialog>

			{/* Delete dialog */}
			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setDeleteEvent(null);
					}
				}}
				open={deleteEvent !== null}
				title="Delete Event"
			>
				{deleteEvent && (
					<DeleteDialog
						event={deleteEvent}
						onClose={() => setDeleteEvent(null)}
						onSuccess={invalidateAll}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}
