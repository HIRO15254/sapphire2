import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// The focus ring is `ring-inset` so it is painted inside the input box. The
// shared Table wraps the <table> in an `overflow-x-auto` div, which the CSS
// spec coerces to `overflow-y: auto`; an outset ring on the bottom-most row
// would overflow that wrapper and be clipped (SA2-70). An inset ring stays
// within the cell and survives the clip regardless of the row.
const BLIND_LEVEL_INPUT_CLASS =
	"h-8 w-full rounded border-0 bg-transparent text-center text-sm outline-none placeholder:text-muted-foreground/40 focus:bg-accent focus:ring-1 focus:ring-inset focus:ring-ring";

/**
 * Borderless numeric cell input for the blind structure table. Always renders
 * as `type="text" inputMode="numeric"` — `type="number"` is banned by
 * `.claude/rules/web-forms.md`; callers parse on blur.
 */
export function BlindLevelInput({
	className,
	onInput,
	...props
}: Omit<ComponentProps<"input">, "type"> & {
	"aria-label": string;
	className?: string;
}) {
	return (
		<input
			inputMode="numeric"
			{...props}
			className={cn(BLIND_LEVEL_INPUT_CLASS, className)}
			onInput={(event) => {
				event.currentTarget.setCustomValidity("");
				event.currentTarget.removeAttribute("aria-invalid");
				onInput?.(event);
			}}
			type="text"
		/>
	);
}
