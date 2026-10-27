import { IconChevronLeft } from "@tabler/icons-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/shared/components/ui/icon-button";
import { usePageHeader } from "./use-page-header";

interface PageHeaderProps extends React.ComponentProps<"div"> {
	actions?: React.ReactNode;
	back?: { fallbackTo: string };
	heading: React.ReactNode;
	meta?: React.ReactNode;
}

export function PageHeader({
	actions,
	back,
	className,
	heading,
	meta,
	...props
}: PageHeaderProps) {
	const { onBack } = usePageHeader(back?.fallbackTo);
	return (
		<header
			className={cn(
				"flex h-[var(--m-navbar-height)] shrink-0 items-center gap-2 border-border border-b px-3.5 md:h-auto md:min-h-12 md:flex-wrap md:px-6 md:py-2",
				back && "gap-0.5 pl-0.5 md:pl-0.5",
				className
			)}
			{...props}
		>
			{back && (
				<IconButton label="Back" onClick={onBack} size="xl" type="button">
					<IconChevronLeft aria-hidden />
				</IconButton>
			)}
			<h1 className="min-w-0 flex-1 font-semibold text-[length:var(--m-text-title)] tracking-[var(--tracking-heading)] md:text-[15px]">
				{heading}
			</h1>
			{meta && (
				<span className="text-[length:var(--m-text-footnote)] text-muted-foreground">
					{meta}
				</span>
			)}
			{actions && (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			)}
		</header>
	);
}
