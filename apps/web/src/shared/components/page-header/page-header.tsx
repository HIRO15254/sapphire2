import type * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.ComponentProps<"div"> {
	actions?: React.ReactNode;
	badge?: React.ReactNode;
	description?: React.ReactNode;
	heading: React.ReactNode;
}

export function PageHeader({
	actions,
	badge,
	className,
	description,
	heading,
	...props
}: PageHeaderProps) {
	return (
		<div
			className={cn(
				"mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
				className
			)}
			{...props}
		>
			<div className="space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="font-bold text-2xl">{heading}</h1>
					{badge}
				</div>
				{description ? (
					<p className="text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex flex-wrap items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}
