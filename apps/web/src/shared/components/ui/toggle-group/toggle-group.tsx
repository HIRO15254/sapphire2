import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function ToggleGroup({
	className,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
	return (
		<ToggleGroupPrimitive.Root
			className={cn(
				"grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-1.5",
				className
			)}
			data-slot="toggle-group"
			{...props}
		/>
	);
}

function ToggleGroupItem({
	className,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
	return (
		<ToggleGroupPrimitive.Item
			className={cn(
				"active:layer-accent-pressed data-[state=off]:hover:layer-accent border-input bg-card text-muted-foreground data-[state=on]:border-ring data-[state=on]:bg-primary-soft data-[state=on]:text-primary-text data-[state=off]:hover:text-foreground inline-flex h-[var(--m-control)] min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3.5 font-medium whitespace-nowrap text-[length:var(--m-text-secondary)] transition-[background-color,color,border-color] outline-none focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="toggle-group-item"
			{...props}
		/>
	);
}

export { ToggleGroup, ToggleGroupItem };
