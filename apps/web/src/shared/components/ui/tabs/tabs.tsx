import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

function TabsList({
	className,
	variant = "underline",
	...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
	variant?: "pill" | "underline";
}) {
	return (
		<TabsPrimitive.List
			className={cn(
				"group/tabs-list flex w-full",
				variant === "underline"
					? "border-border border-b"
					: "bg-muted gap-0.5 rounded-md p-0.5",
				className
			)}
			data-slot="tabs-list"
			data-variant={variant}
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
				"text-muted-foreground hover:text-foreground inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 font-medium whitespace-nowrap text-[length:var(--m-text-secondary)] transition-colors outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
				"group-data-[variant=underline]/tabs-list:data-[state=active]:text-foreground group-data-[variant=underline]/tabs-list:data-[state=active]:border-primary group-data-[variant=underline]/tabs-list:-mb-px group-data-[variant=underline]/tabs-list:min-h-[var(--m-control)] group-data-[variant=underline]/tabs-list:border-b-2 group-data-[variant=underline]/tabs-list:border-transparent group-data-[variant=underline]/tabs-list:px-3.5",
				"group-data-[variant=pill]/tabs-list:data-[state=active]:bg-primary-soft group-data-[variant=pill]/tabs-list:data-[state=active]:text-primary-text group-data-[variant=pill]/tabs-list:min-h-[calc(var(--m-control)-4px)] group-data-[variant=pill]/tabs-list:rounded-sm group-data-[variant=pill]/tabs-list:px-3",
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
