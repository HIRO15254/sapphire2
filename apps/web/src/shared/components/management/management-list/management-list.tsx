import type * as React from "react";
import { cn } from "@/lib/utils";

function ManagementList({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

interface ManagementListItemProps
	extends Omit<React.ComponentProps<"div">, "title"> {
	actions?: React.ReactNode;
	description?: React.ReactNode;
	leading?: React.ReactNode;
	title: React.ReactNode;
}

function ManagementListItem({
	actions,
	children,
	className,
	description,
	leading,
	title,
	...props
}: ManagementListItemProps) {
	return (
		<div
			className={cn("flex items-center rounded-md border p-3", className)}
			data-slot="management-list-item"
			{...props}
		>
			<div className="flex w-full items-center justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						{leading ? <div className="shrink-0">{leading}</div> : null}
						<div className="min-w-0 flex-1">
							<div className="font-medium text-sm">{title}</div>
							{description ? (
								<div className="mt-0.5 text-muted-foreground text-xs">
									{description}
								</div>
							) : null}
						</div>
					</div>
					{children ? <div className="mt-2">{children}</div> : null}
				</div>
				{actions ? <div className="shrink-0">{actions}</div> : null}
			</div>
		</div>
	);
}

export { ManagementList, ManagementListItem };
