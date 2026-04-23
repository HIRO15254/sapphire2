import type * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.ComponentProps<"div"> {
	actions?: React.ReactNode;
	description?: React.ReactNode;
	heading: React.ReactNode;
}

export function PageHeader({
	actions,
	className,
	description,
	heading,
	...props
}: PageHeaderProps) {
	return (
		<div
			className={cn("mb-6 flex items-center justify-between gap-3", className)}
			{...props}
		>
			<div className="min-w-0 flex-1 space-y-1">
				<h1 className="font-bold text-2xl">{heading}</h1>
				{description ? (
					<p className="text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{actions}
				</div>
			) : null}
		</div>
	);
}
