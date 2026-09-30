import type { Icon } from "@tabler/icons-react";
import {
	IconBolt,
	IconChartLine,
	IconCoin,
	IconFlag,
	IconNote,
	IconPlayerPause,
	IconPlayerPlay,
	IconShoppingCart,
	IconUser,
} from "@tabler/icons-react";
import type {
	EventEditorKind,
	TimelineTone,
} from "@/features/live-sessions/utils/timeline-view";

const KIND_ICONS: Record<EventEditorKind, Icon> = {
	allin: IconBolt,
	chips: IconCoin,
	end: IconFlag,
	memo: IconNote,
	purchase: IconShoppingCart,
	seat: IconUser,
	stack: IconChartLine,
	start: IconFlag,
	time: IconPlayerPause,
};

const KIND_TONES: Record<EventEditorKind, TimelineTone> = {
	allin: "warning",
	chips: "primary",
	end: "muted",
	memo: "info",
	purchase: "primary",
	seat: "muted",
	stack: "success",
	start: "muted",
	time: "warning",
};

export const EVENT_TONE_TEXT: Record<TimelineTone, string> = {
	destructive: "text-destructive",
	info: "text-info",
	muted: "text-muted-foreground",
	primary: "text-primary",
	success: "text-success",
	warning: "text-warning",
};

export const EVENT_TONE_MARKER: Record<TimelineTone, string> = {
	destructive:
		"border-destructive/45 bg-[color-mix(in_oklab,var(--destructive)_14%,var(--background))] text-destructive",
	info: "border-info/45 bg-[color-mix(in_oklab,var(--info)_14%,var(--background))] text-info",
	muted:
		"border-border bg-[color-mix(in_oklab,var(--muted-foreground)_10%,var(--background))] text-muted-foreground",
	primary:
		"border-primary/45 bg-[color-mix(in_oklab,var(--primary)_14%,var(--background))] text-primary",
	success:
		"border-success/45 bg-[color-mix(in_oklab,var(--success)_14%,var(--background))] text-success",
	warning:
		"border-warning/45 bg-[color-mix(in_oklab,var(--warning)_14%,var(--background))] text-warning",
};

export function resolveEventIcon(
	kind: EventEditorKind,
	eventType?: string
): Icon {
	if (eventType === "session_resume") {
		return IconPlayerPlay;
	}
	return KIND_ICONS[kind];
}

export function resolveKindTone(kind: EventEditorKind): TimelineTone {
	return KIND_TONES[kind];
}
