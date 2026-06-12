import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PublicPageShellProps {
	actions?: ReactNode;
	aside?: ReactNode;
	children: ReactNode;
	className?: string;
	description: ReactNode;
	eyebrow?: ReactNode;
	title: ReactNode;
}

export function PublicPageShell({
	actions,
	aside,
	children,
	className,
	description,
	eyebrow,
	title,
}: PublicPageShellProps) {
	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_14%,transparent),transparent_40%),linear-gradient(to_bottom,var(--background),color-mix(in_oklab,var(--muted)_30%,transparent))]">
			<div
				className={cn(
					"mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-4 py-10 sm:px-6 lg:px-8",
					className
				)}
			>
				<div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] lg:items-center">
					<div className="hidden space-y-6 lg:block">
						<div className="space-y-3">
							{eyebrow ? (
								<p className="font-medium text-primary text-xs uppercase tracking-[0.28em]">
									{eyebrow}
								</p>
							) : null}
							<h1 className="t-display max-w-2xl">{title}</h1>
							<p className="max-w-2xl text-balance text-lg text-muted-foreground">
								{description}
							</p>
						</div>
						{actions ? (
							<div className="flex flex-wrap items-center gap-3">{actions}</div>
						) : null}
						{aside}
					</div>
					<div>{children}</div>
				</div>
			</div>
		</div>
	);
}
