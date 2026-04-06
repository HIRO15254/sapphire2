import type * as React from "react";
import { cn } from "@/lib/utils";

interface ManagementSectionHeaderProps extends React.ComponentProps<"div"> {
	action?: React.ReactNode;
	controls?: React.ReactNode;
	heading: React.ReactNode;
}

export function ManagementSectionHeader({
	action,
	className,
	controls,
	heading,
	...props
}: ManagementSectionHeaderProps) {
	return (
		<div
			className={cn("flex items-center justify-between gap-2", className)}
			data-slot="management-section-header"
			{...props}
		>
			<div className="flex min-w-0 items-center gap-1">
				<span className="font-medium text-muted-foreground text-xs">
					{heading}
				</span>
				{controls}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	);
}
