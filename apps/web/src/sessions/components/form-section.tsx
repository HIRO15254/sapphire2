import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/shared/components/ui/accordion";

interface FormAccordionProps {
	defaultValue?: string;
	items: Array<{
		children: React.ReactNode;
		title: string;
		value: string;
	}>;
}

export function FormAccordion({ defaultValue, items }: FormAccordionProps) {
	return (
		<Accordion collapsible defaultValue={defaultValue} type="single">
			{items.map((item) => (
				<AccordionItem key={item.value} value={item.value}>
					<AccordionTrigger>{item.title}</AccordionTrigger>
					<AccordionContent>
						<div className="flex flex-col gap-4">{item.children}</div>
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
