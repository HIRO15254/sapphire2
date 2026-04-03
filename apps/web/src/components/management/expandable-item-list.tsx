import type * as React from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface ExpandableItemListProps {
	children: React.ReactNode;
	className?: string;
	onValueChange?: (value: string | null) => void;
	value?: string | null;
}

function ExpandableItemList({
	children,
	className,
	onValueChange,
	value,
}: ExpandableItemListProps) {
	return (
		<Accordion
			className={cn("divide-y", className)}
			collapsible
			onValueChange={(nextValue) => onValueChange?.(nextValue || null)}
			type="single"
			value={value ?? ""}
		>
			{children}
		</Accordion>
	);
}

interface ExpandableItemProps {
	children: React.ReactNode;
	className?: string;
	contentClassName?: string;
	summary: React.ReactNode;
	summaryClassName?: string;
	value: string;
}

function ExpandableItem({
	children,
	className,
	contentClassName,
	summary,
	summaryClassName,
	value,
}: ExpandableItemProps) {
	return (
		<AccordionItem className={cn("border-b-0", className)} value={value}>
			<AccordionTrigger
				className={cn(
					"gap-3 py-2 text-left hover:no-underline",
					summaryClassName
				)}
			>
				{summary}
			</AccordionTrigger>
			<AccordionContent className={cn("pb-2", contentClassName)}>
				{children}
			</AccordionContent>
		</AccordionItem>
	);
}

export { ExpandableItem, ExpandableItemList };
