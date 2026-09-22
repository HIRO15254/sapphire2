import { cva } from "class-variance-authority";
import type { KeyboardEvent } from "react";

export const CRYST_FOCUS_RING =
	"outline-none focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]";

export const CRYST_SCRIM = "bg-black/50 backdrop-blur-[4px]";

export const crystButton = cva(
	`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border font-medium tracking-[var(--tracking-body)] transition-[background-color,color,border-color,filter] active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-50 ${CRYST_FOCUS_RING}`,
	{
		variants: {
			variant: {
				destructive:
					"border-transparent bg-destructive text-destructive-foreground hover:brightness-[1.08]",
				ghost:
					"border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
				outline:
					"border-input bg-card text-foreground shadow-[var(--shadow-sm)] hover:bg-accent hover:text-accent-foreground",
				primary:
					"border-transparent bg-primary text-primary-foreground hover:brightness-110 active:brightness-[.96]",
			},
			size: {
				icon: "size-[var(--m-control)] rounded-md",
				iconMd: "size-8 rounded-md",
				iconSm: "size-7 rounded-md",
				sm: "h-7 rounded-md px-2.5 text-[length:var(--text-xs)]",
				xl: "min-h-[var(--m-control)] rounded-lg px-[18px] text-[length:var(--m-text-body)]",
			},
		},
		defaultVariants: { size: "xl", variant: "primary" },
	}
);

const FIELD_SURFACE =
	"rounded-lg border border-input bg-card text-[length:var(--m-text-body)] transition-[border-color,box-shadow]";

const FIELD_STATES =
	"outline-none focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_var(--selection)] aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50";

export const CRYST_FIELD = `${FIELD_SURFACE} ${FIELD_STATES}`;

export const CRYST_FIELD_MD = `rounded-md border border-input bg-card text-[length:var(--text-sm)] transition-[border-color,box-shadow] ${FIELD_STATES}`;

export const CRYST_FIELD_GROUP = `${FIELD_SURFACE} focus-within:border-ring focus-within:shadow-[0_0_0_3px_var(--selection)]`;

export const CRYST_INLINE_FIELD =
	"rounded-md border border-transparent bg-transparent outline-none transition-[border-color,box-shadow] hover:bg-accent focus-visible:border-ring focus-visible:bg-card focus-visible:shadow-[0_0_0_3px_var(--selection)]";

export const CRYST_BADGE =
	"inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-[7px] font-medium text-[length:var(--text-xs)]";

export const CRYST_BADGE_TONE = {
	info: "bg-[color-mix(in_oklab,var(--info)_15%,transparent)] text-info",
	neutral: "bg-muted text-muted-foreground",
	primary: "bg-[var(--selection)] text-primary",
	warning:
		"bg-[color-mix(in_oklab,var(--warning)_15%,transparent)] text-warning",
} as const;

export const CRYST_CARD =
	"rounded-lg border border-border bg-card text-card-foreground shadow-[var(--shadow-sm)]";

export const CRYST_ALERT =
	"rounded-lg border border-border bg-card text-card-foreground text-[length:var(--text-sm)]";

export const CRYST_LIST_ROW =
	"flex min-h-[var(--m-list-row)] w-full items-center gap-2.5 border-border border-b px-3 text-left text-[length:var(--text-sm)] transition-colors last:border-b-0 hover:bg-accent focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] focus-visible:outline-none";

export const CRYST_TAG =
	"inline-flex h-6 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-md border border-border bg-card px-2 font-medium text-[length:var(--text-xs)] text-foreground";

export const CRYST_TAG_DOT = "size-2 shrink-0 rounded-full";

export const CRYST_TAB_LIST =
	"flex gap-0.5 rounded-md bg-muted p-0.5 text-[length:var(--text-sm)]";

export const CRYST_TAB = `inline-flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-sm px-2.5 py-1 font-medium text-muted-foreground transition-[background-color,color] hover:text-foreground aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-[var(--shadow-sm)] disabled:cursor-not-allowed disabled:opacity-50 ${CRYST_FOCUS_RING}`;

const TAB_KEYS = new Set(["ArrowLeft", "ArrowRight", "End", "Home"]);

export function onCrystTabListKeyDown(event: KeyboardEvent<HTMLElement>) {
	if (!TAB_KEYS.has(event.key)) {
		return;
	}
	const tabs = [
		...event.currentTarget.querySelectorAll<HTMLButtonElement>(
			'[role="tab"]:not(:disabled)'
		),
	];
	const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
	if (current < 0) {
		return;
	}
	event.preventDefault();
	let next = current + (event.key === "ArrowRight" ? 1 : -1);
	if (event.key === "Home") {
		next = 0;
	} else if (event.key === "End") {
		next = tabs.length - 1;
	}
	const target = tabs[(next + tabs.length) % tabs.length];
	target?.focus();
	target?.click();
}
