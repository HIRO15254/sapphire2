import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full border border-transparent px-[7px] text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground",
				destructive: "bg-destructive-soft text-destructive-text",
				outline: "border-border text-muted-foreground bg-transparent",
				primary: "bg-primary-soft text-primary-text",
				secondary: "bg-muted text-foreground",
				success: "bg-success-soft text-success-text",
			},
		},
	}
);

function Badge({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return (
		<span
			className={cn(badgeVariants({ variant }), className)}
			data-slot="badge"
			data-variant={variant}
			{...props}
		/>
	);
}

export { Badge };
