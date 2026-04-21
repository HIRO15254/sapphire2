import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";

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

export const LIFECYCLE_EVENTS = new Set(["session_start", "session_end"]);

export function formatEventLabel(eventType: string) {
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
	session_start: (p) => {
		if (typeof p.buyInAmount === "number") {
			return `Buy-in: ${p.buyInAmount.toLocaleString()}`;
		}
		if (typeof p.timerStartedAt === "number") {
			const date = new Date(p.timerStartedAt * 1000);
			const pad = (n: number) => String(n).padStart(2, "0");
			return `Timer: ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}
		return null;
	},
	session_end: formatSessionEndSummary,
	player_join: (p) => (p.isHero === true ? "Hero" : null),
	player_leave: (p) => (p.isHero === true ? "Hero" : null),
};

export function formatPayloadSummary(eventType: string, payload: unknown) {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const summarizer = PAYLOAD_SUMMARIZERS[eventType];
	return summarizer ? summarizer(payload as Record<string, unknown>) : null;
}

export function getTimeBounds(
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

export type EventGroup =
	| { type: "single"; event: SessionEvent }
	| { type: "player_group"; events: SessionEvent[] };

export function groupEventsForDisplay(events: SessionEvent[]): EventGroup[] {
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
