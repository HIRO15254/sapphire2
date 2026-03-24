import { IconChevronDown } from "@tabler/icons-react";
import { Accordion } from "radix-ui";
import { cn } from "@/lib/utils";

interface FormAccordionProps {
	children: React.ReactNode;
	defaultValue?: string;
	items: Array<{
		children: React.ReactNode;
		title: string;
		value: string;
	}>;
}

export function FormAccordion({ defaultValue, items }: FormAccordionProps) {
	return (
		<Accordion.Root collapsible defaultValue={defaultValue} type="single">
			{items.map((item) => (
				<Accordion.Item key={item.value} value={item.value}>
					<Accordion.Header>
						<Accordion.Trigger className="group flex w-full items-center justify-between border-border border-b py-3 text-left font-medium text-sm [&[data-state=open]>svg]:rotate-180">
							{item.title}
							<IconChevronDown
								className={cn(
									"text-muted-foreground transition-transform duration-200",
									"group-data-[state=open]:text-foreground"
								)}
								size={16}
							/>
						</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
						<div className="flex flex-col gap-4 py-4">{item.children}</div>
					</Accordion.Content>
				</Accordion.Item>
			))}
		</Accordion.Root>
	);
}
