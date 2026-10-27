import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function ItemGroup({
	className,
	size = "default",
	...props
}: React.ComponentProps<"div"> & { size?: "default" | "xl" }) {
	return (
		<div
			className={cn(
				"group/item-group flex min-w-0 flex-col overflow-hidden rounded-md",
				className
			)}
			data-size={size}
			data-slot="item-group"
			{...props}
		/>
	);
}

function Item({
	asChild = false,
	className,
	...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "div";
	return (
		<Comp
			className={cn(
				"[&:is(a,button)]:hover:layer-accent [&:is(a,button)]:active:layer-accent-pressed relative flex min-h-[var(--m-list-row)] w-full items-center gap-2.5 border-border border-b px-3 text-left text-foreground text-sm no-underline outline-none last:border-b-0 focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] group-data-[size=xl]/item-group:gap-3 group-data-[size=xl]/item-group:text-[length:var(--m-text-body)] [&:is(a,button)]:cursor-pointer",
				className
			)}
			data-slot="item"
			{...props}
		/>
	);
}

function ItemMedia({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex flex-none items-center justify-center [&_svg:not([class*='size-'])]:size-4 group-data-[size=xl]/item-group:[&_svg:not([class*='size-'])]:size-[18px]",
				className
			)}
			data-slot="item-media"
			{...props}
		/>
	);
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)}
			data-slot="item-content"
			{...props}
		/>
	);
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("truncate font-medium", className)}
			data-slot="item-title"
			{...props}
		/>
	);
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"inline-flex flex-none items-center gap-0.5 text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="item-actions"
			{...props}
		/>
	);
}

export { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle };
