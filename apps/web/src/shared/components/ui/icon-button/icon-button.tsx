import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
	"hover:layer-accent active:layer-accent-pressed hover:text-foreground inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent p-0 transition-[background-color,color] outline-none focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		defaultVariants: {
			size: "md",
			variant: "ghost",
		},
		variants: {
			size: {
				md: "size-[var(--control-md)]",
				sm: "size-[var(--control-sm)] [&_svg:not([class*='size-'])]:size-3.5",
				xl: "size-[var(--m-control)] [&_svg:not([class*='size-'])]:size-[18px]",
			},
			variant: {
				ghost: "text-muted-foreground bg-transparent",
				outline:
					"border-input bg-card text-foreground shadow-[var(--shadow-sm)]",
			},
		},
	}
);

function IconButton({
	asChild = false,
	className,
	label,
	size = "md",
	variant = "ghost",
	...props
}: Omit<React.ComponentProps<"button">, "aria-label"> &
	VariantProps<typeof iconButtonVariants> & {
		asChild?: boolean;
		label: string;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			aria-label={label}
			className={cn(iconButtonVariants({ className, size, variant }))}
			data-slot="icon-button"
			title={label}
			{...props}
		/>
	);
}

export { IconButton };
