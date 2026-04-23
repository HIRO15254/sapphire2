import type * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderSize = "default" | "compact";

interface PageHeaderProps extends React.ComponentProps<"div"> {
	actions?: React.ReactNode;
	description?: React.ReactNode;
	heading: React.ReactNode;
	size?: PageHeaderSize;
}

export function PageHeader({
	actions,
	className,
	description,
	heading,
	size = "default",
	...props
}: PageHeaderProps) {
	const isCompact = size === "compact";
	return (
		<div
			className={cn(
				"flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
				isCompact ? "mb-2" : "mb-6",
				className
			)}
			{...props}
		>
			<div className="space-y-1">
				<h1 className={cn("font-bold", isCompact ? "text-lg" : "text-2xl")}>
					{heading}
				</h1>
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
