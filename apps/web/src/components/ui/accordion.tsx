import { IconChevronDown } from "@tabler/icons-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Accordion({
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
	return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}

function AccordionItem({
	className,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
	return (
		<AccordionPrimitive.Item
			className={cn("border-b last:border-b-0", className)}
			data-slot="accordion-item"
			{...props}
		/>
	);
}

function AccordionTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="flex" data-slot="accordion-header">
			<AccordionPrimitive.Trigger
				className={cn(
					"flex flex-1 items-center justify-between py-3 font-medium text-sm transition-all [&[data-state=open]>svg]:rotate-180",
					className
				)}
				data-slot="accordion-trigger"
				{...props}
			>
				{children}
				<IconChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

function AccordionContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
	return (
		<AccordionPrimitive.Content
			className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
			data-slot="accordion-content"
			{...props}
		>
			<div className={cn("pb-4", className)}>{children}</div>
		</AccordionPrimitive.Content>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
