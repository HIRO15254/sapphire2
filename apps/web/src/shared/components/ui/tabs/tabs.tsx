import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

function TabsList({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			className={cn("border-border flex w-full border-b", className)}
			data-slot="tabs-list"
			{...props}
		/>
	);
}

function TabsTrigger({
	className,
	count,
	children,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
	count?: number;
}) {
	return (
		<TabsPrimitive.Trigger
			className={cn(
				"text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:border-primary -mb-px inline-flex min-h-[var(--m-control)] min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 border-b-2 border-transparent px-3.5 font-medium whitespace-nowrap text-[length:var(--m-text-secondary)] transition-colors outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
				className
			)}
			data-slot="tabs-trigger"
			{...props}
		>
			{children}
			{count === undefined ? null : (
				<span className="text-muted-foreground text-xs">{count}</span>
			)}
		</TabsPrimitive.Trigger>
	);
}

function TabsContent(
	props: React.ComponentProps<typeof TabsPrimitive.Content>
) {
	return <TabsPrimitive.Content data-slot="tabs-content" {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
