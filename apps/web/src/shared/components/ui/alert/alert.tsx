import { IconCircleX, IconInfoCircle } from "@tabler/icons-react";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
	"border-border text-foreground grid grid-cols-[auto_1fr] gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				default: "bg-card",
				destructive: "bg-destructive-soft",
			},
		},
	}
);

const ALERT_ICONS = {
	default: (
		<IconInfoCircle aria-hidden className="text-primary-text mt-px size-4" />
	),
	destructive: (
		<IconCircleX aria-hidden className="text-destructive-text mt-px size-4" />
	),
};

function Alert({
	children,
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			className={cn(alertVariants({ variant }), className)}
			data-slot="alert"
			role={variant === "destructive" ? "alert" : "status"}
			{...props}
		>
			{ALERT_ICONS[variant ?? "default"]}
			<div>{children}</div>
		</div>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"m-0 text-sm font-semibold tracking-[var(--tracking-heading)]",
				className
			)}
			data-slot="alert-title"
			{...props}
		/>
	);
}

function AlertDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn("text-muted-foreground mt-0.5 mb-0 text-sm", className)}
			data-slot="alert-description"
			{...props}
		/>
	);
}

export { Alert, AlertDescription, AlertTitle };
