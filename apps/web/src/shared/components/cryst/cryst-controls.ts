import { cva } from "class-variance-authority";

export const CRYST_FOCUS_RING =
	"outline-none focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]";

const CRYST_HOVER_LAYER =
	"hover:bg-[image:linear-gradient(var(--state-hover),var(--state-hover))]";

const CRYST_PRESSED_LAYER =
	"active:bg-[image:linear-gradient(var(--state-pressed),var(--state-pressed))]";

export const crystButton = cva(
	`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium tracking-[var(--tracking-body)] no-underline transition-[background-color,color,border-color] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ${CRYST_PRESSED_LAYER} ${CRYST_FOCUS_RING}`,
	{
		variants: {
			variant: {
				ghost: `border-transparent bg-transparent text-muted-foreground hover:text-foreground ${CRYST_HOVER_LAYER}`,
				outline: `border-[var(--line-strong)] bg-card text-foreground shadow-[var(--shadow-sm)] ${CRYST_HOVER_LAYER}`,
				primary:
					"border-transparent bg-primary text-primary-foreground hover:bg-[var(--accent-solid-hover)]",
			},
			size: {
				md: "h-[var(--control-md)] px-3 text-[length:var(--text-sm)]",
				sm: "h-[var(--control-sm)] px-2.5 text-[length:var(--text-xs)]",
				xl: "h-[var(--m-control)] rounded-lg px-[18px] text-[length:var(--m-text-body)]",
			},
		},
		defaultVariants: { size: "xl", variant: "primary" },
	}
);

export const CRYST_BUTTON_ICON_SIZE = { md: 16, sm: 14, xl: 17 } as const;

export const crystIconButton = cva(
	`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border p-0 transition-[background-color,color] disabled:cursor-not-allowed disabled:opacity-50 ${CRYST_HOVER_LAYER} ${CRYST_PRESSED_LAYER} ${CRYST_FOCUS_RING}`,
	{
		variants: {
			variant: {
				ghost:
					"border-transparent bg-transparent text-muted-foreground hover:text-foreground",
				outline:
					"border-[var(--line-strong)] bg-card text-foreground shadow-[var(--shadow-sm)]",
			},
			size: {
				md: "size-[var(--control-md)]",
				xl: "size-[var(--m-control)]",
			},
		},
		defaultVariants: { size: "xl", variant: "ghost" },
	}
);

export const CRYST_ICON_BUTTON_ICON_SIZE = { md: 16, xl: 18 } as const;
