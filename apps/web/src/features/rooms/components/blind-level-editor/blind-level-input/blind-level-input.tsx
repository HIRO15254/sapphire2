import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const BLIND_LEVEL_INPUT_CLASS =
	"h-8 w-full rounded border-0 bg-transparent text-center text-sm outline-none placeholder:text-muted-foreground/40 focus:bg-accent focus:ring-1 focus:ring-inset focus:ring-ring";

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
