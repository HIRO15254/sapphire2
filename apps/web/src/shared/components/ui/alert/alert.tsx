import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
	"relative grid w-full gap-y-1 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:items-start has-[>svg]:gap-x-3 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:text-current",
	{
		variants: {
			variant: {
				default: "border-border bg-card text-card-foreground",
				destructive:
					"border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/15",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			className={cn(alertVariants({ className, variant }))}
			data-slot="alert"
			role="alert"
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
	return (
		<h5
			className={cn(
				"col-start-2 font-medium leading-none tracking-tight",
				className
			)}
			data-slot="alert-title"
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"col-start-2 text-muted-foreground [&_p]:leading-relaxed",
				className
			)}
			data-slot="alert-description"
			{...props}
		/>
	);
}

export { Alert, AlertDescription, AlertTitle };
