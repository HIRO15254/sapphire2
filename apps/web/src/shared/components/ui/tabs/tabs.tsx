import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";
import { Children } from "react";

import { cn } from "@/lib/utils";

function Tabs({
	className,
	orientation = "horizontal",
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			className={cn(
				"group/tabs flex gap-1 data-horizontal:flex-col",
				className
			)}
			data-orientation={orientation}
			data-slot="tabs"
			{...props}
		/>
	);
}

const tabsListVariants = cva(
	"group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground data-[variant=line]:rounded-none group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
	{
		variants: {
			variant: {
				// The active state is a single `::after` "pill" that slides to the
				// active trigger (translateX) rather than cross-fading per trigger.
				// Works for any tab count: `TabsList` sets `--tabs-count` from its
				// child count, so the pill width is `1 / N` and each active trigger
				// shifts it by whole multiples of its own width. Hidden in the
				// vertical orientation.
				default:
					"relative bg-muted after:absolute after:inset-y-[3px] after:left-[3px] after:z-0 after:w-[calc((100%-6px)/var(--tabs-count,2))] after:rounded-md after:border after:border-foreground/20 after:bg-background after:shadow-sm after:transition-transform after:duration-200 after:ease-out after:content-[''] has-[>[data-slot=tabs-trigger]:nth-child(2)[data-state=active]]:after:translate-x-full has-[>[data-slot=tabs-trigger]:nth-child(3)[data-state=active]]:after:translate-x-[200%] has-[>[data-slot=tabs-trigger]:nth-child(4)[data-state=active]]:after:translate-x-[300%] has-[>[data-slot=tabs-trigger]:nth-child(5)[data-state=active]]:after:translate-x-[400%] group-data-vertical/tabs:after:hidden dark:after:bg-foreground/15",
				line: "gap-1 bg-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

function TabsList({
	className,
	variant = "default",
	children,
	style,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
	VariantProps<typeof tabsListVariants>) {
	// Drives the sliding-pill width (`1 / N`) so the default variant renders
	// correctly for any number of tabs, not just two.
	const count = Children.toArray(children).length;
	return (
		<TabsPrimitive.List
			className={cn(tabsListVariants({ variant }), className)}
			data-slot="tabs-list"
			data-variant={variant}
			style={{ ...style, "--tabs-count": count } as React.CSSProperties}
			{...props}
		>
			{children}
		</TabsPrimitive.List>
	);
}

function TabsTrigger({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			className={cn(
				// `z-10` keeps the label above the sliding pill (`::after`, z-0).
				"relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-1.5 py-0.5 font-medium text-foreground/60 text-sm transition-colors duration-200 ease-out hover:text-foreground focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-active:text-foreground group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start dark:text-muted-foreground dark:data-active:text-foreground dark:hover:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				// Line variant: per-trigger underline indicator.
				"after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
				className
			)}
			data-slot="tabs-trigger"
			{...props}
		/>
	);
}

function TabsContent({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			className={cn("flex-1 text-sm outline-none", className)}
			data-slot="tabs-content"
			{...props}
		/>
	);
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
