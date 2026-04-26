import type * as React from "react";
import { cn } from "@/lib/utils";

export function ManagementSectionState({
	className,
	...props
}: React.ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"py-1 text-center text-[11px] text-muted-foreground",
				className
			)}
			data-slot="management-section-state"
			{...props}
		/>
	);
}
