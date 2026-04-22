import type * as React from "react";
import { cn } from "@/lib/utils";

interface PageSectionProps extends React.ComponentProps<"section"> {
	actions?: React.ReactNode;
	description?: React.ReactNode;
	heading: React.ReactNode;
}

export function PageSection({
	actions,
	children,
	className,
	description,
	heading,
	...props
}: PageSectionProps) {
	return (
		<section
			className={cn("rounded-lg border bg-card p-4", className)}
			{...props}
		>
			<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<h2 className="font-semibold text-lg">{heading}</h2>
					{description ? (
						<p className="text-muted-foreground text-sm">{description}</p>
					) : null}
				</div>
				{actions ? (
					<div className="flex flex-wrap items-center gap-2">{actions}</div>
				) : null}
			</div>
			{children}
		</section>
	);
}
