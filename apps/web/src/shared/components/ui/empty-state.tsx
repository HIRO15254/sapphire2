import type * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.ComponentProps<"div"> {
	action?: React.ReactNode;
	description?: React.ReactNode;
	heading: React.ReactNode;
	icon?: React.ReactNode;
}

function EmptyState({
	action,
	className,
	description,
	heading,
	icon,
	...props
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-4 rounded-xl border border-border/80 border-dashed bg-muted/20 px-6 py-16 text-center text-muted-foreground",
				className
			)}
			data-slot="empty-state"
			{...props}
		>
			{icon ? <div className="text-muted-foreground/80">{icon}</div> : null}
			<div className="space-y-1">
				<div className="font-medium text-foreground text-lg">{heading}</div>
				{description ? <div className="text-sm">{description}</div> : null}
			</div>
			{action ? <div className="pt-1">{action}</div> : null}
		</div>
	);
}

export { EmptyState };
