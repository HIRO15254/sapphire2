import { cva, type VariantProps } from "class-variance-authority";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type * as React from "react";
import { buttonVariants } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";

function ToggleGroup({
	className,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
	return (
		<ToggleGroupPrimitive.Root
			className={cn("flex flex-wrap items-center gap-2", className)}
			data-slot="toggle-group"
			{...props}
		/>
	);
}

const toggleGroupItemVariants = cva(
	cn(
		buttonVariants({ size: "sm", variant: "outline" }),
		"border-border bg-background hover:bg-muted hover:text-foreground data-[state=on]:border-foreground/25 data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:shadow-sm"
	),
	{
		variants: {
			size: {
				default: "",
				sm: "h-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]",
				lg: "h-9 px-3 text-sm",
			},
		},
		defaultVariants: {
			size: "default",
		},
	}
);

function ToggleGroupItem({
	className,
	size,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
	VariantProps<typeof toggleGroupItemVariants>) {
	return (
		<ToggleGroupPrimitive.Item
			className={cn(toggleGroupItemVariants({ className, size }))}
			data-slot="toggle-group-item"
			{...props}
		/>
	);
}

export { ToggleGroup, ToggleGroupItem };
