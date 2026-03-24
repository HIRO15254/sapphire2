import { IconChevronDown } from "@tabler/icons-react";
import { Collapsible } from "radix-ui";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
	children: React.ReactNode;
	defaultOpen?: boolean;
	title: string;
}

export function FormSection({
	children,
	defaultOpen = true,
	title,
}: FormSectionProps) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<Collapsible.Root onOpenChange={setOpen} open={open}>
			<Collapsible.Trigger className="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-left font-medium text-sm hover:bg-muted/50">
				{title}
				<IconChevronDown
					className={cn(
						"text-muted-foreground transition-transform",
						open && "rotate-180 text-foreground"
					)}
					size={16}
				/>
			</Collapsible.Trigger>
			<Collapsible.Content className="flex flex-col gap-4 pt-2">
				{children}
			</Collapsible.Content>
		</Collapsible.Root>
	);
}
