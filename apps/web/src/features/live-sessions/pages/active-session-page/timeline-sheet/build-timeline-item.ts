import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import { computeAllInPreview } from "@/features/live-sessions/utils/all-in-preview";
import { formatEventLabel } from "@/features/live-sessions/utils/session-events-formatters";
import { toTimeInputValue } from "@/features/live-sessions/utils/stack-editor-time";
import { formatNumber } from "@/utils/format-number";
import type { TimelineItemViewModel } from "./timeline-item";

type EventColor =
	| "destructive"
	| "info"
	| "muted"
	| "primary"
	| "success"
	| "warning";

const DOT_COLOR_BY_EVENT_TYPE: Record<string, EventColor> = {
	update_stack: "success",
	all_in: "warning",
	memo: "info",
	purchase_chips: "primary",
	player_join: "muted",
	player_leave: "muted",
	session_pause: "warning",
	session_resume: "warning",
	session_start: "muted",
	session_end: "muted",
};

const DOT_CLASS_BY_COLOR: Record<EventColor, string> = {
	success: "bg-success",
	warning: "bg-warning",
	primary: "bg-primary",
	info: "bg-info",
	destructive: "bg-destructive",
	muted: "bg-muted-foreground",
};

const STATIC_TITLE_BY_EVENT_TYPE: Record<string, string> = {
	update_stack: "Stack update",
	all_in: "All-in",
	session_pause: "Pause",
	session_resume: "Resume",
	session_start: "Session start",
	session_end: "Session end",
};

function getPayloadRecord(payload: unknown): Record<string, unknown> | null {
	return payload && typeof payload === "object"
		? (payload as Record<string, unknown>)
		: null;
}

function getNumberField(payload: unknown, key: string): number | null {
	const value = getPayloadRecord(payload)?.[key];
	return typeof value === "number" ? value : null;
}

function getStringField(payload: unknown, key: string): string | null {
	const value = getPayloadRecord(payload)?.[key];
	return typeof value === "string" ? value : null;
}

function getBooleanField(payload: unknown, key: string): boolean | null {
	const value = getPayloadRecord(payload)?.[key];
	return typeof value === "boolean" ? value : null;
}

interface ChipPurchaseCountLike {
	count: number;
	name: string;
}

function getChipPurchaseCounts(payload: unknown): ChipPurchaseCountLike[] {
	const raw = getPayloadRecord(payload)?.chipPurchaseCounts;
	if (!Array.isArray(raw)) {
		return [];
	}
	const result: ChipPurchaseCountLike[] = [];
	for (const entry of raw) {
		const record = getPayloadRecord(entry);
		const name = typeof record?.name === "string" ? record.name : null;
		const count = typeof record?.count === "number" ? record.count : null;
		if (name !== null && count !== null) {
			result.push({ name, count });
		}
	}
	return result;
}

function resolveDotColor(eventType: string, payload: unknown): EventColor {
	if (eventType === "chips_add_remove") {
		const amount = getNumberField(payload, "amount");
		return amount !== null && amount < 0 ? "destructive" : "primary";
	}
	return DOT_COLOR_BY_EVENT_TYPE[eventType] ?? "muted";
}

function buildChipsAddRemoveTitle(payload: unknown): string {
	const amount = getNumberField(payload, "amount");
	return amount !== null && amount < 0 ? "Chip withdrawal" : "Chip add";
}

function buildPurchaseChipsTitle(payload: unknown): string {
	const name = getStringField(payload, "name");
	return name ? `Chip purchase — ${name}` : "Chip purchase";
}

function buildMemoTitle(payload: unknown): string {
	const text = getStringField(payload, "text");
	return text ? `Note — ${text}` : "Note";
}

function buildPlayerSeatTitle(
	eventType: string,
	payload: unknown,
	playerNameById: ReadonlyMap<string, string>
): string {
	const playerId = getStringField(payload, "playerId");
	const name = playerId ? (playerNameById.get(playerId) ?? null) : null;
	const label = name ?? "Player";
	if (eventType === "player_leave") {
		return `${label} left the table`;
	}
	const seatPosition = getNumberField(payload, "seatPosition");
	return seatPosition === null
		? `${label} seated`
		: `${label} seated at S${seatPosition + 1}`;
}

function buildTitle(
	event: SessionEvent,
	playerNameById: ReadonlyMap<string, string>
): string {
	switch (event.eventType) {
		case "chips_add_remove":
			return buildChipsAddRemoveTitle(event.payload);
		case "purchase_chips":
			return buildPurchaseChipsTitle(event.payload);
		case "memo":
			return buildMemoTitle(event.payload);
		case "player_join":
		case "player_leave":
			return buildPlayerSeatTitle(
				event.eventType,
				event.payload,
				playerNameById
			);
		default:
			return (
				STATIC_TITLE_BY_EVENT_TYPE[event.eventType] ??
				formatEventLabel(event.eventType)
			);
	}
}

function buildUpdateStackSub(payload: unknown): string | null {
	const remaining = getNumberField(payload, "remainingPlayers");
	const total = getNumberField(payload, "totalEntries");
	const parts: string[] = [];
	if (remaining !== null && total !== null) {
		parts.push(`${formatNumber(remaining)} / ${formatNumber(total)} left`);
	} else if (remaining !== null) {
		parts.push(`${formatNumber(remaining)} left`);
	} else if (total !== null) {
		parts.push(`${formatNumber(total)} entries`);
	}
	const purchases = getChipPurchaseCounts(payload).filter((c) => c.count > 0);
	if (purchases.length > 0) {
		const purchasesText = purchases
			.map((c) => `${c.name} ×${formatNumber(c.count)}`)
			.join(", ");
		parts.push(`purchases: ${purchasesText}`);
	}
	return parts.length > 0 ? parts.join(" · ") : null;
}

function buildAllInSub(payload: unknown): string | null {
	const potSize = getNumberField(payload, "potSize");
	const equity = getNumberField(payload, "equity");
	const trials = getNumberField(payload, "trials");
	const wins = getNumberField(payload, "wins");
	const parts: string[] = [];
	if (potSize !== null) {
		parts.push(`Pot ${formatNumber(potSize)}`);
	}
	if (equity !== null) {
		parts.push(`Eq ${formatNumber(equity)}%`);
	}
	if (trials !== null && wins !== null) {
		parts.push(`${formatNumber(wins)} of ${formatNumber(trials)} won`);
	}
	if (potSize !== null && equity !== null && trials !== null && wins !== null) {
		const preview = computeAllInPreview({ potSize, equity, trials, wins });
		if (preview) {
			const rounded = Math.round(preview.evDelta);
			parts.push(`EV delta ${rounded >= 0 ? "+" : ""}${formatNumber(rounded)}`);
		}
	}
	return parts.length > 0 ? parts.join(" · ") : null;
}

function buildPurchaseChipsSub(payload: unknown): string | null {
	const cost = getNumberField(payload, "cost");
	const chips = getNumberField(payload, "chips");
	if (cost === null || chips === null) {
		return null;
	}
	return `Cost ${formatNumber(cost)} · +${formatNumber(chips)} chips`;
}

function buildSessionStartSub(payload: unknown): string | null {
	const buyIn = getNumberField(payload, "buyInAmount");
	if (buyIn !== null) {
		return `Buy-in ${formatNumber(buyIn)}`;
	}
	const timerStartedAt = getNumberField(payload, "timerStartedAt");
	if (timerStartedAt !== null) {
		const date = new Date(timerStartedAt * 1000);
		const pad = (n: number) => String(n).padStart(2, "0");
		return `Timer start ${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}
	return null;
}

function buildSessionEndSub(payload: unknown): string | null {
	const cashOut = getNumberField(payload, "cashOutAmount");
	if (cashOut !== null) {
		return `Cash-out ${formatNumber(cashOut)}`;
	}
	if (getBooleanField(payload, "beforeDeadline") === true) {
		return "- / - entries";
	}
	const placement = getNumberField(payload, "placement");
	const total = getNumberField(payload, "totalEntries");
	if (placement !== null && total !== null) {
		return `#${placement} / ${total}`;
	}
	if (placement !== null) {
		return `#${placement}`;
	}
	return null;
}

function buildSub(event: SessionEvent): string | null {
	switch (event.eventType) {
		case "update_stack":
			return buildUpdateStackSub(event.payload);
		case "all_in":
			return buildAllInSub(event.payload);
		case "purchase_chips":
			return buildPurchaseChipsSub(event.payload);
		case "session_start":
			return buildSessionStartSub(event.payload);
		case "session_end":
			return buildSessionEndSub(event.payload);
		default:
			return null;
	}
}

function buildAmountText(event: SessionEvent): string | null {
	if (event.eventType === "chips_add_remove") {
		const amount = getNumberField(event.payload, "amount");
		if (amount === null) {
			return null;
		}
		return amount < 0 ? formatNumber(amount) : `+${formatNumber(amount)}`;
	}
	if (event.eventType === "update_stack") {
		const stackAmount = getNumberField(event.payload, "stackAmount");
		return stackAmount === null ? null : formatNumber(stackAmount);
	}
	return null;
}

export function buildTimelineItem(
	event: SessionEvent,
	playerNameById: ReadonlyMap<string, string>,
	onEdit: (event: SessionEvent) => void
): TimelineItemViewModel {
	return {
		id: event.id,
		time: toTimeInputValue(event.occurredAt),
		dotClass:
			DOT_CLASS_BY_COLOR[resolveDotColor(event.eventType, event.payload)],
		title: buildTitle(event, playerNameById),
		sub: buildSub(event),
		amountText: buildAmountText(event),
		onEdit: () => onEdit(event),
	};
}
