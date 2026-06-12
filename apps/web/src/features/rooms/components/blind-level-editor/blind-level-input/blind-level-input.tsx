import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const BLIND_LEVEL_INPUT_CLASS =
	"h-8 w-full rounded border-0 bg-transparent text-center text-sm outline-none placeholder:text-muted-foreground/40 focus:bg-accent focus:ring-1 focus:ring-ring";

/**
 * Borderless numeric cell input for the blind structure table. Always renders
 * as `type="text" inputMode="numeric"` — `type="number"` is banned by
 * `.claude/rules/web-forms.md`; callers parse on blur.
 */
export function BlindLevelInput(
	props: Omit<ComponentProps<"input">, "type"> & { className?: string }
) {
	return (
		<input
			inputMode="numeric"
			{...props}
			className={cn(BLIND_LEVEL_INPUT_CLASS, props.className)}
			type="text"
		/>
	);
}
