import type { Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CrystEmptyStateProps {
	action?: ReactNode;
	className?: string;
	description?: string;
	icon: Icon;
	size?: "md" | "sm";
	title?: string;
}

export function CrystEmptyState({
	action,
	className,
	description,
	icon: IconComponent,
	size = "md",
	title,
}: CrystEmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-1.5 text-center text-[length:var(--text-sm)]",
				size === "sm" ? "px-4 py-6" : "px-6 py-12",
				className
			)}
		>
			<IconComponent
				aria-hidden
				className="mb-0.5 text-muted-foreground"
				size={size === "sm" ? 20 : 24}
			/>
			{title === undefined ? null : <p className="font-medium">{title}</p>}
			{description === undefined ? null : (
				<p className="max-w-[44ch] text-pretty text-muted-foreground">
					{description}
				</p>
			)}
			{action === undefined ? null : (
				<div className="mt-2.5 flex gap-2">{action}</div>
			)}
		</div>
	);
}
