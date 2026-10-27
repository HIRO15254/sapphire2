import type { Icon } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface CrystEmptyStateProps {
	className?: string;
	description?: string;
	icon: Icon;
	title: string;
}

export function CrystEmptyState({
	className,
	description,
	icon: IconComponent,
	title,
}: CrystEmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-1.5 px-6 py-12 text-center text-foreground",
				className
			)}
		>
			<IconComponent
				aria-hidden
				className="mb-0.5 text-muted-foreground"
				size={24}
			/>
			<p className="m-0 font-medium text-[length:var(--text-sm)]">{title}</p>
			{description === undefined ? null : (
				<p className="m-0 max-w-[44ch] text-[length:var(--text-sm)] text-muted-foreground">
					{description}
				</p>
			)}
		</div>
	);
}
