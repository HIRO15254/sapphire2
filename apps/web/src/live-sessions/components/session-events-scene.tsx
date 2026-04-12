import { IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import {
	type SessionEvent,
	useSessionEvents,
} from "@/live-sessions/hooks/use-session-events";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";

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
	onSubmit: (payload: unknown, occurredAt?: number) => void;
	onTimeUpdate: (occurredAt: number) => void;
	sessionType: SessionType;
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
	session_pause: () => "Paused",
	session_resume: () => "Resumed",
};

function formatPayloadSummary(eventType: string, payload: unknown) {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const summarizer = PAYLOAD_SUMMARIZERS[eventType];
	return summarizer ? summarizer(payload as Record<string, unknown>) : null;
}

// --- Editor shared helpers ---

interface TimeFieldProps {
	error: string | null;
	onChange: (value: string) => void;
	value: string;
}

function TimeField({ error, onChange, value }: TimeFieldProps) {
	return (
		<Field error={error} htmlFor="edit-time" label="Time">
			<Input
				id="edit-time"
				onChange={(e) => onChange(e.target.value)}
				type="time"
				value={value}
			/>
		</Field>
	);
}

interface SaveButtonProps {
	disabled: boolean;
	isLoading: boolean;
	onClick: () => void;
}

function SaveButton({ disabled, isLoading, onClick }: SaveButtonProps) {
	return (
		<DialogActionRow>
			<Button disabled={disabled || isLoading} onClick={onClick} type="button">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</DialogActionRow>
	);
}

// --- Individual editors ---

type EditorBaseProps = Pick<
	EventEditorProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit" | "onTimeUpdate"
>;

function TimeOnlyEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onTimeUpdate,
}: Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onTimeUpdate"
>) {
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<TimeField error={error} onChange={setTime} value={time} />
			<SaveButton
				disabled={error !== null}
				isLoading={isLoading}
				onClick={() => {
					const newDate = applyTimeToDate(event.occurredAt, time);
					onTimeUpdate(Math.floor(newDate.getTime() / 1000));
				}}
			/>
		</div>
	);
}

function ChipsAddRemoveEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: EditorBaseProps) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const [amount, setAmount] = useState(String(payload.amount ?? 0));
	const [type, setType] = useState<string>(
		payload.type === "remove" ? "remove" : "add"
	);
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<TimeField error={error} onChange={setTime} value={time} />
			<Field htmlFor="edit-amount" label="Amount">
				<Input
					id="edit-amount"
					inputMode="numeric"
					min={0}
					onChange={(e) => setAmount(e.target.value)}
					type="number"
					value={amount}
				/>
			</Field>
			<Field htmlFor="edit-type" label="Type">
				<ToggleGroup
					onValueChange={(val) => {
						if (val) {
							setType(val);
						}
					}}
					type="single"
					value={type}
				>
					<ToggleGroupItem value="add">Add</ToggleGroupItem>
					<ToggleGroupItem value="remove">Remove</ToggleGroupItem>
				</ToggleGroup>
			</Field>
			<SaveButton
				disabled={error !== null}
				isLoading={isLoading}
				onClick={() => {
					const newDate = applyTimeToDate(event.occurredAt, time);
					onSubmit(
						{ amount: Number(amount), type },
						Math.floor(newDate.getTime() / 1000)
					);
				}}
			/>
		</div>
	);
}

function UpdateStackEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: EditorBaseProps) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const [stackAmount, setStackAmount] = useState(
		String(payload.stackAmount ?? 0)
	);
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<TimeField error={error} onChange={setTime} value={time} />
			<Field htmlFor="edit-stackAmount" label="Stack Amount">
				<Input
					id="edit-stackAmount"
					inputMode="numeric"
					min={0}
					onChange={(e) => setStackAmount(e.target.value)}
					type="number"
					value={stackAmount}
				/>
			</Field>
			<SaveButton
				disabled={error !== null}
				isLoading={isLoading}
				onClick={() => {
					const newDate = applyTimeToDate(event.occurredAt, time);
					onSubmit(
						{ stackAmount: Number(stackAmount) },
						Math.floor(newDate.getTime() / 1000)
					);
				}}
			/>
		</div>
	);
}

function AllInEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: EditorBaseProps) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const [potSize, setPotSize] = useState(String(payload.potSize ?? 0));
	const [trials, setTrials] = useState(String(payload.trials ?? 1));
	const [equity, setEquity] = useState(String(payload.equity ?? 0));
	const [wins, setWins] = useState(String(payload.wins ?? 0));
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<TimeField error={error} onChange={setTime} value={time} />
			<Field htmlFor="edit-potSize" label="Pot Size">
				<Input
					id="edit-potSize"
					inputMode="numeric"
					min={0}
					onChange={(e) => setPotSize(e.target.value)}
					type="number"
					value={potSize}
				/>
			</Field>
			<Field htmlFor="edit-trials" label="Trials">
				<Input
					id="edit-trials"
					inputMode="numeric"
					min={1}
					onChange={(e) => setTrials(e.target.value)}
					type="number"
					value={trials}
				/>
			</Field>
			<Field htmlFor="edit-equity" label="Equity (%)">
				<Input
					id="edit-equity"
					inputMode="decimal"
					max={100}
					min={0}
					onChange={(e) => setEquity(e.target.value)}
					type="number"
					value={equity}
				/>
			</Field>
			<Field htmlFor="edit-wins" label="Wins">
				<Input
					id="edit-wins"
					inputMode="numeric"
					min={0}
					onChange={(e) => setWins(e.target.value)}
					type="number"
					value={wins}
				/>
			</Field>
			<SaveButton
				disabled={error !== null}
				isLoading={isLoading}
				onClick={() => {
					const newDate = applyTimeToDate(event.occurredAt, time);
					onSubmit(
						{
							potSize: Number(potSize),
							trials: Number(trials),
							equity: Number(equity),
							wins: Number(wins),
						},
						Math.floor(newDate.getTime() / 1000)
					);
				}}
			/>
		</div>
	);
}

function MemoEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: EditorBaseProps) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const [text, setText] = useState(
		typeof payload.text === "string" ? payload.text : ""
	);
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<TimeField error={error} onChange={setTime} value={time} />
			<Field htmlFor="edit-memo" label="Memo">
				<Textarea
					id="edit-memo"
					onChange={(e) => setText(e.target.value)}
					value={text}
				/>
			</Field>
			<SaveButton
				disabled={error !== null || text.trim().length === 0}
				isLoading={isLoading}
				onClick={() => {
					const newDate = applyTimeToDate(event.occurredAt, time);
					onSubmit({ text }, Math.floor(newDate.getTime() / 1000));
				}}
			/>
		</div>
	);
}

function PurchaseChipsEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: EditorBaseProps) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const [name, setName] = useState(
		typeof payload.name === "string" ? payload.name : ""
	);
	const [cost, setCost] = useState(String(payload.cost ?? 0));
	const [chips, setChips] = useState(String(payload.chips ?? 0));
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<TimeField error={error} onChange={setTime} value={time} />
			<Field htmlFor="edit-name" label="Name">
				<Input
					id="edit-name"
					onChange={(e) => setName(e.target.value)}
					value={name}
				/>
			</Field>
			<Field htmlFor="edit-cost" label="Cost">
				<Input
					id="edit-cost"
					inputMode="numeric"
					min={0}
					onChange={(e) => setCost(e.target.value)}
					type="number"
					value={cost}
				/>
			</Field>
			<Field htmlFor="edit-chips" label="Chips">
				<Input
					id="edit-chips"
					inputMode="numeric"
					min={0}
					onChange={(e) => setChips(e.target.value)}
					type="number"
					value={chips}
				/>
			</Field>
			<SaveButton
				disabled={error !== null || name.trim().length === 0}
				isLoading={isLoading}
				onClick={() => {
					const newDate = applyTimeToDate(event.occurredAt, time);
					onSubmit(
						{ name, cost: Number(cost), chips: Number(chips) },
						Math.floor(newDate.getTime() / 1000)
					);
				}}
			/>
		</div>
	);
}

function UpdateTournamentInfoEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: EditorBaseProps) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const [remainingPlayers, setRemainingPlayers] = useState(
		typeof payload.remainingPlayers === "number"
			? String(payload.remainingPlayers)
			: ""
	);
	const [totalEntries, setTotalEntries] = useState(
		typeof payload.totalEntries === "number" ? String(payload.totalEntries) : ""
	);
	const [averageStack, setAverageStack] = useState(
		typeof payload.averageStack === "number" ? String(payload.averageStack) : ""
	);
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<TimeField error={error} onChange={setTime} value={time} />
			<Field htmlFor="edit-remainingPlayers" label="Remaining Players">
				<Input
					id="edit-remainingPlayers"
					inputMode="numeric"
					min={1}
					onChange={(e) => setRemainingPlayers(e.target.value)}
					placeholder="Optional"
					type="number"
					value={remainingPlayers}
				/>
			</Field>
			<Field htmlFor="edit-totalEntries" label="Total Entries">
				<Input
					id="edit-totalEntries"
					inputMode="numeric"
					min={1}
					onChange={(e) => setTotalEntries(e.target.value)}
					placeholder="Optional"
					type="number"
					value={totalEntries}
				/>
			</Field>
			<Field htmlFor="edit-averageStack" label="Average Stack">
				<Input
					id="edit-averageStack"
					inputMode="numeric"
					min={0}
					onChange={(e) => setAverageStack(e.target.value)}
					placeholder="Optional"
					type="number"
					value={averageStack}
				/>
			</Field>
			<SaveButton
				disabled={error !== null}
				isLoading={isLoading}
				onClick={() => {
					const newDate = applyTimeToDate(event.occurredAt, time);
					onSubmit(
						{
							remainingPlayers: remainingPlayers
								? Number(remainingPlayers)
								: null,
							totalEntries: totalEntries ? Number(totalEntries) : null,
							averageStack: averageStack ? Number(averageStack) : null,
						},
						Math.floor(newDate.getTime() / 1000)
					);
				}}
			/>
		</div>
	);
}

function SessionStartEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onTimeUpdate,
	sessionType,
}: Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onTimeUpdate"
> & {
	sessionType: SessionType;
}) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<TimeField error={error} onChange={setTime} value={time} />
			{sessionType === "cash_game" &&
			typeof payload.buyInAmount === "number" ? (
				<Field htmlFor="edit-buyInAmount" label="Buy-in Amount">
					<Input
						disabled
						id="edit-buyInAmount"
						readOnly
						type="text"
						value={payload.buyInAmount.toLocaleString()}
					/>
				</Field>
			) : null}
			<SaveButton
				disabled={error !== null}
				isLoading={isLoading}
				onClick={() => {
					const newDate = applyTimeToDate(event.occurredAt, time);
					onTimeUpdate(Math.floor(newDate.getTime() / 1000));
				}}
			/>
		</div>
	);
}

function SessionEndEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onTimeUpdate,
	sessionType,
}: Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onTimeUpdate"
> & {
	sessionType: SessionType;
}) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const [time, setTime] = useState(formatTime(event.occurredAt));
	const error = validateTime(time, event.occurredAt, minTime, maxTime);
	return (
		<div className="flex flex-col gap-4">
			<TimeField error={error} onChange={setTime} value={time} />
			{sessionType === "cash_game" &&
			typeof payload.cashOutAmount === "number" ? (
				<Field htmlFor="edit-cashOutAmount" label="Cash-out Amount">
					<Input
						disabled
						id="edit-cashOutAmount"
						readOnly
						type="text"
						value={payload.cashOutAmount.toLocaleString()}
					/>
				</Field>
			) : null}
			{sessionType === "tournament" && (
				<>
					{typeof payload.placement === "number" ? (
						<Field htmlFor="edit-placement" label="Placement">
							<Input
								disabled
								id="edit-placement"
								readOnly
								type="text"
								value={String(payload.placement)}
							/>
						</Field>
					) : null}
					{typeof payload.totalEntries === "number" ? (
						<Field htmlFor="edit-totalEntries" label="Total Entries">
							<Input
								disabled
								id="edit-totalEntries"
								readOnly
								type="text"
								value={String(payload.totalEntries)}
							/>
						</Field>
					) : null}
					{typeof payload.prizeMoney === "number" ? (
						<Field htmlFor="edit-prizeMoney" label="Prize Money">
							<Input
								disabled
								id="edit-prizeMoney"
								readOnly
								type="text"
								value={payload.prizeMoney.toLocaleString()}
							/>
						</Field>
					) : null}
					{typeof payload.bountyPrizes === "number" ? (
						<Field htmlFor="edit-bountyPrizes" label="Bounty Prizes">
							<Input
								disabled
								id="edit-bountyPrizes"
								readOnly
								type="text"
								value={payload.bountyPrizes.toLocaleString()}
							/>
						</Field>
					) : null}
				</>
			)}
			<SaveButton
				disabled={error !== null}
				isLoading={isLoading}
				onClick={() => {
					const newDate = applyTimeToDate(event.occurredAt, time);
					onTimeUpdate(Math.floor(newDate.getTime() / 1000));
				}}
			/>
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
	onSubmit,
	onTimeUpdate,
	sessionType,
}: EventEditorProps) {
	if (event.eventType === "session_start") {
		return (
			<SessionStartEditor
				event={event}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onTimeUpdate={onTimeUpdate}
				sessionType={sessionType}
			/>
		);
	}
	if (event.eventType === "session_end") {
		return (
			<SessionEndEditor
				event={event}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onTimeUpdate={onTimeUpdate}
				sessionType={sessionType}
			/>
		);
	}
	if (
		event.eventType === "session_pause" ||
		event.eventType === "session_resume"
	) {
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
	if (event.eventType === "chips_add_remove") {
		return (
			<ChipsAddRemoveEditor
				event={event}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onSubmit={onSubmit}
				onTimeUpdate={onTimeUpdate}
			/>
		);
	}
	if (event.eventType === "update_stack") {
		return (
			<UpdateStackEditor
				event={event}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onSubmit={onSubmit}
				onTimeUpdate={onTimeUpdate}
			/>
		);
	}
	if (event.eventType === "all_in") {
		return (
			<AllInEditor
				event={event}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onSubmit={onSubmit}
				onTimeUpdate={onTimeUpdate}
			/>
		);
	}
	if (event.eventType === "purchase_chips") {
		return (
			<PurchaseChipsEditor
				event={event}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onSubmit={onSubmit}
				onTimeUpdate={onTimeUpdate}
			/>
		);
	}
	if (event.eventType === "update_tournament_info") {
		return (
			<UpdateTournamentInfoEditor
				event={event}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onSubmit={onSubmit}
				onTimeUpdate={onTimeUpdate}
			/>
		);
	}
	if (event.eventType === "memo") {
		return (
			<MemoEditor
				event={event}
				isLoading={isLoading}
				maxTime={maxTime}
				minTime={minTime}
				onSubmit={onSubmit}
				onTimeUpdate={onTimeUpdate}
			/>
		);
	}
	// player_join, player_leave: time only
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

export function SessionEventsScene({
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
						const canDelete = !isLifecycle;
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
										</div>
										<div className="flex shrink-0 items-center gap-1">
											{canDelete && confirmingDeleteId === event.id ? (
												<>
													<span className="text-destructive text-xs">
														Delete?
													</span>
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
