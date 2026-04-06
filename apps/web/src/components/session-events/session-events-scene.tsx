import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StackRecordEditor } from "@/components/live-sessions/stack-record-editor";
import { TournamentStackRecordEditor } from "@/components/live-tournament/tournament-stack-record-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogActionRow } from "@/components/ui/dialog-action-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

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

export interface SessionEvent {
	eventType: string;
	id: string;
	occurredAt: string | Date;
	payload: unknown;
}

interface SessionSummaryData {
	summary?: Record<string, unknown>;
	[key: string]: unknown;
}

type SessionType = "cash_game" | "tournament";

interface SessionEventsSceneProps {
	emptySessionMessage?: string;
	refetchInterval?: number;
	sessionId: string;
	sessionLoading?: boolean;
	sessionType: SessionType;
}

interface EventEditorProps {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onDelete: () => void;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
	onTimeUpdate: (occurredAt: number) => void;
}

interface NormalizedStackPayload {
	chipPurchaseCounts: Array<{
		name: string;
		count: number;
		chipsPerUnit: number;
	}>;
	chipPurchases: Array<{ name: string; cost: number; chips: number }>;
	remainingPlayers: number | null;
	stackAmount: number;
	totalEntries: number | null;
}

function formatEventLabel(eventType: string) {
	return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

function formatTime(value: string | Date) {
	const date = typeof value === "string" ? new Date(value) : value;
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function applyTimeToDate(original: string | Date, timeStr: string) {
	const date = new Date(typeof original === "string" ? original : original);
	const [h, m] = timeStr.split(":").map(Number);
	date.setHours(h ?? 0, m ?? 0, 0, 0);
	return date;
}

function validateTime(
	timeStr: string,
	original: string | Date,
	minTime: Date | null,
	maxTime: Date | null
) {
	const newDate = applyTimeToDate(original, timeStr);
	if (minTime && newDate.getTime() < minTime.getTime()) {
		return `Must be after ${formatTime(minTime)}`;
	}
	if (maxTime && newDate.getTime() > maxTime.getTime()) {
		return `Must be before ${formatTime(maxTime)}`;
	}
	return null;
}

function formatTournamentStackSummary(payload: Record<string, unknown>) {
	if (typeof payload.stackAmount !== "number") {
		return null;
	}
	const parts = [`Stack: ${payload.stackAmount.toLocaleString()}`];
	if (typeof payload.remainingPlayers === "number") {
		parts.push(`${payload.remainingPlayers} left`);
	}
	if (typeof payload.totalEntries === "number") {
		parts.push(`${payload.totalEntries} entries`);
	}
	if (
		Array.isArray(payload.chipPurchases) &&
		payload.chipPurchases.length > 0
	) {
		const names = (payload.chipPurchases as Array<{ name?: unknown }>)
			.map((chipPurchase) =>
				typeof chipPurchase.name === "string" ? chipPurchase.name : "Purchase"
			)
			.join(", ");
		parts.push(names);
	} else {
		if (payload.rebuy && typeof payload.rebuy === "object") {
			parts.push("Rebuy");
		}
		if (payload.addon && typeof payload.addon === "object") {
			parts.push("Addon");
		}
	}
	return parts.join(" · ");
}

function formatTournamentResultSummary(payload: Record<string, unknown>) {
	const parts: string[] = [];
	if (typeof payload.placement === "number") {
		parts.push(`#${payload.placement}`);
	}
	if (typeof payload.totalEntries === "number") {
		parts.push(`/${payload.totalEntries}`);
	}
	if (typeof payload.prizeMoney === "number" && payload.prizeMoney > 0) {
		parts.push(`Prize: ${payload.prizeMoney.toLocaleString()}`);
	}
	return parts.join(" ") || null;
}

function formatPayloadSummary(eventType: string, payload: unknown) {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const objectPayload = payload as Record<string, unknown>;
	if (eventType === "chip_add" && typeof objectPayload.amount === "number") {
		return `Amount: ${objectPayload.amount.toLocaleString()}`;
	}
	if (
		eventType === "stack_record" &&
		typeof objectPayload.stackAmount === "number"
	) {
		const parts = [`Stack: ${objectPayload.stackAmount.toLocaleString()}`];
		if (
			Array.isArray(objectPayload.allIns) &&
			objectPayload.allIns.length > 0
		) {
			parts.push(`${objectPayload.allIns.length} all-in(s)`);
		}
		return parts.join(" · ");
	}
	if (eventType === "tournament_stack_record") {
		return formatTournamentStackSummary(objectPayload);
	}
	if (eventType === "tournament_result") {
		return formatTournamentResultSummary(objectPayload);
	}
	return null;
}

function normalizeTournamentStackPayload(
	payload: Record<string, unknown>
): NormalizedStackPayload {
	const hasNewPurchases = Array.isArray(payload.chipPurchases);
	const legacyPurchases: Array<{ name: string; cost: number; chips: number }> =
		[];
	if (!hasNewPurchases && payload.rebuy && typeof payload.rebuy === "object") {
		const rebuy = payload.rebuy as Record<string, unknown>;
		legacyPurchases.push({
			name: "Rebuy",
			cost: typeof rebuy.cost === "number" ? rebuy.cost : 0,
			chips: typeof rebuy.chips === "number" ? rebuy.chips : 0,
		});
	}
	if (!hasNewPurchases && payload.addon && typeof payload.addon === "object") {
		const addon = payload.addon as Record<string, unknown>;
		legacyPurchases.push({
			name: "Addon",
			cost: typeof addon.cost === "number" ? addon.cost : 0,
			chips: typeof addon.chips === "number" ? addon.chips : 0,
		});
	}
	return {
		stackAmount:
			typeof payload.stackAmount === "number" ? payload.stackAmount : 0,
		remainingPlayers:
			typeof payload.remainingPlayers === "number"
				? payload.remainingPlayers
				: null,
		totalEntries:
			typeof payload.totalEntries === "number" ? payload.totalEntries : null,
		chipPurchases: hasNewPurchases
			? (payload.chipPurchases as Array<{
					name: string;
					cost: number;
					chips: number;
				}>)
			: legacyPurchases,
		chipPurchaseCounts: Array.isArray(payload.chipPurchaseCounts)
			? (payload.chipPurchaseCounts as Array<{
					name: string;
					count: number;
					chipsPerUnit: number;
				}>)
			: [],
	};
}

function applyChipAddSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	if (typeof payload.amount !== "number") {
		return;
	}

	if (typeof summary.currentStack === "number") {
		summary.currentStack = payload.amount;
	}
}

function applyStackRecordSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	if (typeof payload.stackAmount === "number") {
		summary.currentStack = payload.stackAmount;
	}

	if (Array.isArray(payload.allIns)) {
		summary.addonCount = payload.allIns.length;
	}
}

function getChipPurchaseCountTotal(items: unknown[]) {
	return items.reduce<number>(
		(total, item) =>
			total +
			(typeof (item as { count?: unknown }).count === "number"
				? (item as { count: number }).count
				: 0),
		0
	);
}

function applyTournamentStackSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	const typedPayload = payload as {
		chipPurchaseCounts?: unknown[];
		remainingPlayers?: number | null;
		stackAmount?: number;
		totalEntries?: number | null;
	};

	if (typeof typedPayload.stackAmount === "number") {
		summary.currentStack = typedPayload.stackAmount;
	}

	if (typeof typedPayload.remainingPlayers === "number") {
		summary.remainingPlayers = typedPayload.remainingPlayers;
	}

	if (typeof typedPayload.totalEntries === "number") {
		summary.totalEntries = typedPayload.totalEntries;
	}

	if (Array.isArray(typedPayload.chipPurchaseCounts)) {
		summary.totalChipPurchases = getChipPurchaseCountTotal(
			typedPayload.chipPurchaseCounts
		);
	}
}

function applyTournamentResultSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	const typedPayload = payload as {
		bountyPrizes?: number | null;
		prizeMoney?: number;
		totalEntries?: number;
	};

	if (typeof typedPayload.totalEntries === "number") {
		summary.totalEntries = typedPayload.totalEntries;
	}

	if (typeof typedPayload.prizeMoney === "number") {
		summary.profitLoss =
			typedPayload.prizeMoney +
			(typeof typedPayload.bountyPrizes === "number"
				? typedPayload.bountyPrizes
				: 0);
	}
}

function buildOptimisticSessionSummary(
	summary: Record<string, unknown>,
	eventType: string,
	payload: Record<string, unknown>,
	occurredAt?: number
) {
	const nextSummary = { ...summary };

	if (eventType === "chip_add") {
		applyChipAddSummary(nextSummary, payload);
	}

	if (eventType === "stack_record") {
		applyStackRecordSummary(nextSummary, payload);
	}

	if (eventType === "tournament_stack_record") {
		applyTournamentStackSummary(nextSummary, payload);
	}

	if (eventType === "tournament_result") {
		applyTournamentResultSummary(nextSummary, payload);
	}

	if (occurredAt) {
		nextSummary.lastUpdatedAt = occurredAt;
	}

	return nextSummary;
}

function renderStackRecordDetail(payload: Record<string, unknown>) {
	if (!Array.isArray(payload.allIns) || payload.allIns.length === 0) {
		return null;
	}
	return (
		<ul className="mt-1 flex flex-col gap-0.5">
			{payload.allIns.map((item, index) => {
				if (!item || typeof item !== "object") {
					return null;
				}
				const allIn = item as Record<string, unknown>;
				const parts: string[] = [];
				if (typeof allIn.potSize === "number") {
					parts.push(`Pot: ${allIn.potSize.toLocaleString()}`);
				}
				if (typeof allIn.equity === "number") {
					parts.push(`Equity: ${allIn.equity}%`);
				}
				if (typeof allIn.wins === "number") {
					parts.push(`Wins: ${allIn.wins}`);
				}
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: static payload order
					<li className="text-muted-foreground text-xs" key={index}>
						All-in {index + 1}: {parts.join(", ")}
					</li>
				);
			})}
		</ul>
	);
}

function renderTournamentStackDetail(payload: Record<string, unknown>) {
	const details: string[] = [];
	if (
		Array.isArray(payload.chipPurchases) &&
		payload.chipPurchases.length > 0
	) {
		for (const chipPurchase of payload.chipPurchases as Record<
			string,
			unknown
		>[]) {
			if (typeof chipPurchase.name === "string") {
				details.push(
					`${chipPurchase.name}: cost ${chipPurchase.cost}, chips ${chipPurchase.chips}`
				);
			}
		}
	} else {
		if (payload.rebuy && typeof payload.rebuy === "object") {
			const rebuy = payload.rebuy as Record<string, unknown>;
			details.push(`Rebuy: cost ${rebuy.cost}, chips ${rebuy.chips}`);
		}
		if (payload.addon && typeof payload.addon === "object") {
			const addon = payload.addon as Record<string, unknown>;
			details.push(`Addon: cost ${addon.cost}, chips ${addon.chips}`);
		}
	}
	if (details.length === 0) {
		return null;
	}
	return (
		<ul className="mt-1 flex flex-col gap-0.5">
			{details.map((detail) => (
				<li className="text-muted-foreground text-xs" key={detail}>
					{detail}
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
	const objectPayload = payload as Record<string, unknown>;
	if (eventType === "stack_record") {
		return renderStackRecordDetail(objectPayload);
	}
	if (eventType === "tournament_stack_record") {
		return renderTournamentStackDetail(objectPayload);
	}
	return null;
}

function TimeOnlyEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onTimeUpdate,
}: Pick<
	EventEditorProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onTimeUpdate"
>) {
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<Field error={error} htmlFor="edit-time" label="Time">
				<Input
					id="edit-time"
					onChange={(event) => setTime(event.target.value)}
					type="time"
					value={time}
				/>
			</Field>
			<DialogActionRow>
				<Button
					disabled={isLoading || error !== null}
					onClick={() => {
						const newDate = applyTimeToDate(event.occurredAt, time);
						onTimeUpdate(Math.floor(newDate.getTime() / 1000));
					}}
					type="button"
				>
					{isLoading ? "Saving..." : "Save"}
				</Button>
			</DialogActionRow>
		</div>
	);
}

function AmountEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onDelete,
	onSubmit,
}: Pick<
	EventEditorProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onDelete" | "onSubmit"
>) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const [amount, setAmount] = useState(String(payload.amount ?? 0));
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<Field error={error} htmlFor="edit-time" label="Time">
				<Input
					id="edit-time"
					onChange={(event) => setTime(event.target.value)}
					type="time"
					value={time}
				/>
			</Field>
			<Field htmlFor="edit-amount" label="Amount">
				<Input
					id="edit-amount"
					inputMode="numeric"
					min={0}
					onChange={(event) => setAmount(event.target.value)}
					type="number"
					value={amount}
				/>
			</Field>
			<DialogActionRow>
				<Button onClick={onDelete} type="button" variant="destructive">
					Delete
				</Button>
				<Button
					disabled={isLoading || error !== null}
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
			</DialogActionRow>
		</div>
	);
}

function TournamentResultEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onDelete,
	onSubmit,
}: Pick<
	EventEditorProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onDelete" | "onSubmit"
>) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const [placement, setPlacement] = useState(String(payload.placement ?? 1));
	const [totalEntries, setTotalEntries] = useState(
		String(payload.totalEntries ?? 1)
	);
	const [prizeMoney, setPrizeMoney] = useState(String(payload.prizeMoney ?? 0));
	const [bountyPrizes, setBountyPrizes] = useState(
		payload.bountyPrizes !== null && payload.bountyPrizes !== undefined
			? String(payload.bountyPrizes)
			: ""
	);
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<Field error={error} htmlFor="edit-time" label="Time">
				<Input
					id="edit-time"
					onChange={(event) => setTime(event.target.value)}
					type="time"
					value={time}
				/>
			</Field>
			<Field htmlFor="edit-placement" label="Placement">
				<Input
					id="edit-placement"
					inputMode="numeric"
					min={1}
					onChange={(event) => setPlacement(event.target.value)}
					required
					type="number"
					value={placement}
				/>
			</Field>
			<Field htmlFor="edit-totalEntries" label="Total Entries">
				<Input
					id="edit-totalEntries"
					inputMode="numeric"
					min={1}
					onChange={(event) => setTotalEntries(event.target.value)}
					required
					type="number"
					value={totalEntries}
				/>
			</Field>
			<Field htmlFor="edit-prizeMoney" label="Prize Money">
				<Input
					id="edit-prizeMoney"
					inputMode="numeric"
					min={0}
					onChange={(event) => setPrizeMoney(event.target.value)}
					required
					type="number"
					value={prizeMoney}
				/>
			</Field>
			<Field htmlFor="edit-bountyPrizes" label="Bounty Prizes">
				<Input
					id="edit-bountyPrizes"
					inputMode="numeric"
					min={0}
					onChange={(event) => setBountyPrizes(event.target.value)}
					type="number"
					value={bountyPrizes}
				/>
			</Field>
			<DialogActionRow>
				<Button onClick={onDelete} type="button" variant="destructive">
					Delete
				</Button>
				<Button
					disabled={isLoading || error !== null}
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
			</DialogActionRow>
		</div>
	);
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

function EventEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onDelete,
	onSubmit,
	onTimeUpdate,
}: EventEditorProps) {
	if (LIFECYCLE_EVENTS.has(event.eventType)) {
		return (
			<TimeOnlyEditor
				event={event}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onTimeUpdate={onTimeUpdate}
			/>
		);
	}
	if (event.eventType === "stack_record") {
		return (
			<StackRecordEditor
				initialOccurredAt={event.occurredAt}
				initialPayload={{
					stackAmount:
						(event.payload as { stackAmount?: number })?.stackAmount ?? 0,
					allIns: Array.isArray((event.payload as { allIns?: unknown })?.allIns)
						? ((event.payload as { allIns: unknown[] }).allIns as Array<{
								equity: number;
								potSize: number;
								trials: number;
								wins: number;
							}>)
						: [],
				}}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onDelete={onDelete}
				onSubmit={(payload, occurredAt) => onSubmit(payload, occurredAt)}
			/>
		);
	}
	if (event.eventType === "tournament_stack_record") {
		return (
			<TournamentStackRecordEditor
				initialOccurredAt={event.occurredAt}
				initialPayload={normalizeTournamentStackPayload(
					(event.payload ?? {}) as Record<string, unknown>
				)}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onDelete={onDelete}
				onSubmit={(payload, occurredAt) => onSubmit(payload, occurredAt)}
			/>
		);
	}
	if (event.eventType === "tournament_result") {
		return (
			<TournamentResultEditor
				event={event}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onDelete={onDelete}
				onSubmit={onSubmit}
			/>
		);
	}
	return (
		<AmountEditor
			event={event}
			isLoading={isLoading}
			maxTime={maxTime}
			minTime={minTime}
			onDelete={onDelete}
			onSubmit={onSubmit}
		/>
	);
}

export function SessionEventsScene({
	emptySessionMessage = "No active session",
	refetchInterval,
	sessionId,
	sessionLoading = false,
	sessionType,
}: SessionEventsSceneProps) {
	const queryClient = useQueryClient();
	const [editEvent, setEditEvent] = useState<SessionEvent | null>(null);
	const eventQueryInput =
		sessionType === "tournament"
			? { liveTournamentSessionId: sessionId }
			: { liveCashGameSessionId: sessionId };
	const eventsQueryOptions =
		trpc.sessionEvent.list.queryOptions(eventQueryInput);
	const eventsQuery = useQuery({
		...eventsQueryOptions,
		enabled: !!sessionId,
		...(refetchInterval ? { refetchInterval } : {}),
	});
	const events = (eventsQuery.data ?? []) as SessionEvent[];
	const sessionKey =
		sessionType === "tournament"
			? trpc.liveTournamentSession.getById.queryOptions({ id: sessionId })
					.queryKey
			: trpc.liveCashGameSession.getById.queryOptions({ id: sessionId })
					.queryKey;
	const applyEventSummaryToSession = (
		event: SessionEvent,
		payload: unknown,
		occurredAt?: number
	) => {
		queryClient.setQueryData<SessionSummaryData>(sessionKey, (old) => {
			if (!(old?.summary && payload) || typeof payload !== "object") {
				return old;
			}

			return {
				...old,
				summary: buildOptimisticSessionSummary(
					old.summary,
					event.eventType,
					payload as Record<string, unknown>,
					occurredAt
				),
			};
		});
	};
	const invalidateAll = async () => {
		await invalidateTargets(queryClient, [
			{ queryKey: eventsQueryOptions.queryKey },
			{ queryKey: sessionKey },
		]);
	};
	const updateMutation = useMutation({
		mutationFn: (args: {
			id: string;
			occurredAt?: number;
			payload?: unknown;
		}) => trpcClient.sessionEvent.update.mutate(args),
		onMutate: async (args) => {
			await cancelTargets(queryClient, [
				{ queryKey: eventsQueryOptions.queryKey },
				{ queryKey: sessionKey },
			]);
			const previousEvents = snapshotQuery(
				queryClient,
				eventsQueryOptions.queryKey
			);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			const targetEvent = events.find((event) => event.id === args.id);
			queryClient.setQueryData<SessionEvent[]>(
				eventsQueryOptions.queryKey,
				(old) =>
					old?.map((event) =>
						event.id === args.id
							? {
									...event,
									occurredAt: args.occurredAt
										? new Date(args.occurredAt * 1000).toISOString()
										: event.occurredAt,
									payload: args.payload ?? event.payload,
								}
							: event
					) ?? []
			);
			if (targetEvent && args.payload) {
				applyEventSummaryToSession(targetEvent, args.payload, args.occurredAt);
			}
			return { previousEvents, previousSession };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousEvents,
				context?.previousSession,
			]);
		},
		onSuccess: async () => {
			await invalidateAll();
			setEditEvent(null);
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.sessionEvent.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: eventsQueryOptions.queryKey },
				{ queryKey: sessionKey },
			]);
			const previousEvents = snapshotQuery(
				queryClient,
				eventsQueryOptions.queryKey
			);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			queryClient.setQueryData<SessionEvent[]>(
				eventsQueryOptions.queryKey,
				(old) => old?.filter((event) => event.id !== id) ?? []
			);
			return { previousEvents, previousSession };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousEvents,
				context?.previousSession,
			]);
		},
		onSuccess: async () => {
			await invalidateAll();
			setEditEvent(null);
		},
	});
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
	return (
		<div className="p-4 md:p-6">
			<div className="mb-4 flex flex-wrap items-center gap-2">
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
											{payloadSummary ? (
												<p className="mt-0.5 text-muted-foreground text-xs">
													{payloadSummary}
												</p>
											) : null}
											<EventDetail
												eventType={event.eventType}
												payload={event.payload}
											/>
										</div>
										<div className="flex shrink-0 gap-1">
											<Button
												aria-label={`Edit ${formatEventLabel(event.eventType)}`}
												onClick={() => setEditEvent(event)}
												size="icon-xs"
												variant="ghost"
											>
												<IconPencil size={14} />
											</Button>
											{isLifecycle ? null : (
												<Button
													aria-label={`Delete ${formatEventLabel(event.eventType)}`}
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
				{editEvent ? (
					<EventEditor
						event={editEvent}
						isLoading={updateMutation.isPending}
						maxTime={timeBounds.maxTime}
						minTime={timeBounds.minTime}
						onDelete={() => deleteMutation.mutate(editEvent.id)}
						onSubmit={(payload, occurredAt) =>
							updateMutation.mutate({
								id: editEvent.id,
								payload,
								occurredAt,
							})
						}
						onTimeUpdate={(occurredAt) =>
							updateMutation.mutate({ id: editEvent.id, occurredAt })
						}
					/>
				) : null}
			</ResponsiveDialog>
		</div>
	);
}
