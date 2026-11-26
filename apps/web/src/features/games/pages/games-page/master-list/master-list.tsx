import { IconDots, IconRefresh } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Alert, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/shared/components/ui/empty";
import { Spinner } from "@/shared/components/ui/spinner";

const CAPS =
	"text-muted-foreground text-[11px] font-semibold tracking-[var(--tracking-caps)] uppercase";

export function MasterSection({
	aside,
	children,
	label,
	title,
}: {
	aside?: string;
	children: ReactNode;
	label?: string;
	title: string;
}) {
	return (
		<section aria-label={label ?? title} className="flex flex-col gap-1.5">
			<div className="flex items-baseline gap-3 px-0.5">
				<h2 className={cn(CAPS, "m-0 flex-none whitespace-nowrap")}>{title}</h2>
				{aside ? (
					<span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-[length:var(--m-text-footnote)]">
						{aside}
					</span>
				) : null}
			</div>
			{children}
		</section>
	);
}

export function MasterList({ children }: { children: ReactNode }) {
	return (
		<div className="bg-card border-border flex flex-col overflow-hidden rounded-lg border">
			{children}
		</div>
	);
}

const ROW =
	"border-border text-foreground hover:layer-accent active:layer-accent-pressed flex w-full cursor-pointer items-center gap-2.5 border-t pr-2 pl-3 text-left outline-none first:border-t-0 focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]";

export function CompactRow({
	dimmed,
	label,
	meta,
	onOpen,
}: {
	dimmed: boolean;
	label: string;
	meta: string;
	onOpen: () => void;
}) {
	return (
		<button
			className={cn(ROW, "min-h-10", dimmed && "text-muted-foreground")}
			onClick={onOpen}
			type="button"
		>
			<span className="min-w-0 flex-1 truncate">{label}</span>
			<span className="text-muted-foreground font-mono text-xs">{meta}</span>
			<IconDots
				aria-hidden
				className="text-muted-foreground size-4 flex-none"
			/>
		</button>
	);
}

export function DetailRow({
	count,
	dimmed,
	label,
	mono,
	onOpen,
	summary,
}: {
	count: string;
	dimmed: boolean;
	label: string;
	mono: boolean;
	onOpen: () => void;
	summary: string;
}) {
	return (
		<button
			className={cn(ROW, "min-h-14 py-2", dimmed && "text-muted-foreground")}
			onClick={onOpen}
			type="button"
		>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="truncate">{label}</span>
				{summary ? (
					<span
						className={cn(
							"text-muted-foreground truncate",
							mono
								? "font-mono text-xs"
								: "text-[length:var(--m-text-footnote)]"
						)}
					>
						{summary}
					</span>
				) : null}
			</span>
			{count ? (
				<span className="text-muted-foreground whitespace-nowrap text-[length:var(--m-text-footnote)]">
					{count}
				</span>
			) : null}
			<IconDots
				aria-hidden
				className="text-muted-foreground size-4 flex-none"
			/>
		</button>
	);
}

export function LoadAlert({
	isRetrying,
	onRetry,
	title,
	variant,
}: {
	isRetrying: boolean;
	onRetry: () => void;
	title: string;
	variant: "destructive" | "warning";
}) {
	return (
		<Alert variant={variant}>
			<AlertTitle>{title}</AlertTitle>
			<Button
				aria-busy={isRetrying}
				className="mt-2"
				disabled={isRetrying}
				onClick={onRetry}
				size="sm"
				type="button"
				variant="outline"
			>
				<IconRefresh aria-hidden />
				Retry
			</Button>
		</Alert>
	);
}

export function EmptyList({ icon, title }: { icon: ReactNode; title: string }) {
	return (
		<Empty className="px-3.5 py-6">
			<EmptyHeader>
				<EmptyMedia>{icon}</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
			</EmptyHeader>
		</Empty>
	);
}

export function ListLoading() {
	return (
		<div className="text-muted-foreground flex justify-center py-6">
			<Spinner />
		</div>
	);
}
