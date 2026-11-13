import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { Select as SelectPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
	return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectValue(
	props: React.ComponentProps<typeof SelectPrimitive.Value>
) {
	return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
	return (
		<SelectPrimitive.Trigger
			className={cn(
				"border-input bg-card text-foreground focus-visible:border-ring data-[state=open]:border-ring aria-invalid:border-destructive data-[placeholder]:text-muted-foreground inline-flex h-[var(--m-control)] w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border pr-2.5 pl-3 text-left text-[length:var(--m-text-body)] transition-[border-color,box-shadow] outline-none focus-visible:shadow-[0_0_0_1px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:shadow-[0_0_0_1px_var(--ring)] [&>span]:min-w-0 [&>span]:truncate",
				className
			)}
			data-slot="select-trigger"
			{...props}
		>
			{children}
			<SelectPrimitive.Icon asChild>
				<IconChevronDown
					aria-hidden
					className="text-muted-foreground size-3.5 flex-none"
				/>
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
}

function SelectContent({
	className,
	children,
	position = "popper",
	...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				className={cn(
					"bg-popover text-foreground border-border relative z-[60] max-h-[min(300px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border p-1 shadow-[var(--shadow-popover)]",
					className
				)}
				data-slot="select-content"
				position={position}
				sideOffset={4}
				{...props}
			>
				<SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	);
}

function SelectItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
	return (
		<SelectPrimitive.Item
			className={cn(
				"data-[highlighted]:layer-accent active:layer-accent-pressed flex min-h-[var(--m-list-row)] cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[length:var(--m-text-body)] outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
				className
			)}
			data-slot="select-item"
			{...props}
		>
			<SelectPrimitive.ItemText>
				<span className="min-w-0 flex-1 truncate">{children}</span>
			</SelectPrimitive.ItemText>
			<SelectPrimitive.ItemIndicator className="text-primary-text ml-auto flex flex-none">
				<IconCheck aria-hidden className="size-[15px]" />
			</SelectPrimitive.ItemIndicator>
		</SelectPrimitive.Item>
	);
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
