import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"group/button aria-invalid:border-destructive inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent font-medium tracking-[var(--tracking-body)] whitespace-nowrap no-underline transition-[background-color,color,border-color] outline-none select-none focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		compoundVariants: [{ className: "h-auto px-0", variant: "link" }],
		defaultVariants: {
			size: "default",
			variant: "default",
		},
		variants: {
			size: {
				default: "h-[var(--control-md)] px-3 text-sm",
				icon: "size-[var(--control-md)] p-0",
				lg: "h-[var(--control-lg)] px-4 text-sm",
				sm: "h-[var(--control-sm)] px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
				xl: "h-[var(--m-control)] rounded-lg px-[18px] text-[length:var(--m-text-body)] [&_svg:not([class*='size-'])]:size-[17px]",
			},
			variant: {
				default:
					"active:layer-accent-pressed bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover",
				destructive:
					"active:layer-accent-pressed bg-destructive text-destructive-foreground hover:bg-destructive-hover",
				ghost:
					"hover:layer-accent active:layer-accent-pressed text-muted-foreground hover:text-foreground bg-transparent",
				link: "text-primary-text bg-transparent underline-offset-4 hover:underline",
				outline:
					"hover:layer-accent active:layer-accent-pressed border-input bg-card text-foreground shadow-[var(--shadow-sm)]",
				secondary:
					"hover:layer-accent active:layer-accent-pressed bg-muted text-foreground",
			},
		},
	}
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			className={cn(buttonVariants({ className, size, variant }))}
			data-size={size}
			data-slot="button"
			data-variant={variant}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
