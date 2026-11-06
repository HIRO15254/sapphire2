import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function ItemGroup({
	className,
	size = "default",
	variant = "default",
	...props
}: React.ComponentProps<"div"> & {
	size?: "default" | "xl";
	variant?: "default" | "inset";
}) {
	return (
		<div
			className={cn(
				"group/item-group flex min-w-0 flex-col overflow-hidden rounded-md",
				variant === "inset" && "border-border bg-muted rounded-xl border",
				className
			)}
			data-size={size}
			data-slot="item-group"
			data-variant={variant}
			{...props}
		/>
	);
}

const itemVariants = cva(
	"[&:is(a,button)]:hover:layer-accent [&:is(a,button)]:active:layer-accent-pressed border-border group-data-[variant=inset]/item-group:before:border-border-subtle relative flex min-h-[var(--m-list-row)] w-full items-center gap-2.5 border-b px-3 text-left text-sm no-underline outline-none group-data-[size=xl]/item-group:gap-3 group-data-[size=xl]/item-group:text-[length:var(--m-text-body)] group-data-[variant=inset]/item-group:border-b-0 group-data-[variant=inset]/item-group:px-3.5 group-data-[size=xl]/item-group:group-data-[variant=inset]/item-group:min-h-12 group-data-[variant=inset]/item-group:before:absolute group-data-[variant=inset]/item-group:before:top-0 group-data-[variant=inset]/item-group:before:right-0 group-data-[variant=inset]/item-group:before:left-3.5 group-data-[variant=inset]/item-group:before:border-t group-data-[variant=inset]/item-group:first:before:hidden last:border-b-0 focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 group-data-[variant=inset]/item-group:has-[>[data-slot=item-media]]:before:left-10 group-data-[size=xl]/item-group:group-data-[variant=inset]/item-group:has-[>[data-slot=item-media]]:before:left-[46px] [&:is(a,button)]:cursor-pointer",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				default: "text-foreground",
				destructive: "text-destructive-text",
			},
		},
	}
);

function Item({
	asChild = false,
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> &
	VariantProps<typeof itemVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "div";
	return (
		<Comp
			className={cn(itemVariants({ className, variant }))}
			data-slot="item"
			data-variant={variant}
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

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn("text-muted-foreground m-0 truncate text-xs", className)}
			data-slot="item-description"
			{...props}
		/>
	);
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-muted-foreground inline-flex flex-none items-center gap-2.5 text-xs whitespace-nowrap [&_svg:not([class*='size-'])]:size-4",
				className
			)}
			data-slot="item-actions"
			{...props}
		/>
	);
}

export {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
};
