import type { Icon } from "@tabler/icons-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RadioGroup } from "@/shared/components/ui/radio-group";
import { CRYST_FOCUS_RING } from "./cryst-controls";

export function RadioCardGroup({
	className,
	...props
}: ComponentProps<typeof RadioGroup>) {
	return (
		<RadioGroup className={cn("grid-cols-1 gap-1.5", className)} {...props} />
	);
}

interface RadioCardProps {
	description?: ReactNode;
	icon: Icon;
	meta?: ReactNode;
	title: ReactNode;
	value: string;
}

export function RadioCard({
	description,
	icon: CardIcon,
	meta,
	title,
	value,
}: RadioCardProps) {
	return (
		<RadioGroupPrimitive.Item
			className={cn(
				"group flex min-h-[var(--m-list-row)] w-full items-center gap-3 rounded-lg border border-input bg-card px-3.5 py-3 text-left text-card-foreground transition-[background-color,border-color,box-shadow] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-[var(--selection)] data-[state=checked]:shadow-[inset_0_0_0_1px_var(--primary)] data-[state=checked]:hover:bg-[var(--selection)]",
				CRYST_FOCUS_RING,
				"data-[state=checked]:focus-visible:shadow-[inset_0_0_0_1px_var(--primary),0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]"
			)}
			value={value}
		>
			<CardIcon
				aria-hidden
				className="shrink-0 text-muted-foreground group-data-[state=checked]:text-primary"
				size={16}
			/>
			<span className="flex min-w-0 flex-1 flex-col gap-px">
				<span className="font-semibold text-[length:var(--m-text-secondary)] leading-tight">
					{title}
				</span>
				{description ? (
					<span className="text-[length:var(--m-text-footnote)] text-muted-foreground">
						{description}
					</span>
				) : null}
			</span>
			{meta === undefined ? null : (
				<span className="shrink-0 font-mono text-[length:var(--m-text-secondary)] tabular-nums">
					{meta}
				</span>
			)}
		</RadioGroupPrimitive.Item>
	);
}
