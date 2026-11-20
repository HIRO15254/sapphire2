import { type Icon, IconChevronRight, IconDots } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/shared/components/ui/empty";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemMedia,
} from "@/shared/components/ui/item";

export function ListSection({
	children,
	heading,
}: {
	children: ReactNode;
	heading: string;
}) {
	return (
		<section aria-label={heading} className="flex flex-col gap-1.5">
			<h2 className="text-muted-foreground m-0 text-[11px] font-semibold tracking-[var(--tracking-caps)] uppercase">
				{heading}
			</h2>
			{children}
		</section>
	);
}

export function ListCard({
	children,
	label,
}: {
	children: ReactNode;
	label?: string;
}) {
	return (
		<ItemGroup
			aria-label={label}
			className="bg-card border-border rounded-lg border"
		>
			{children}
		</ItemGroup>
	);
}

interface ListRowProps {
	dimmed?: boolean;
	icon: ReactNode;
	meta?: ReactNode;
	onClick: () => void;
	title: ReactNode;
	trailing?: "chevron" | "dots";
	value?: ReactNode;
}

export function ListRow({
	dimmed = false,
	icon,
	meta,
	onClick,
	title,
	trailing = "chevron",
	value,
}: ListRowProps) {
	const Trailing: Icon = trailing === "dots" ? IconDots : IconChevronRight;
	return (
		<Item asChild>
			<button
				className={cn("pr-2", dimmed && "text-muted-foreground")}
				onClick={onClick}
				type="button"
			>
				<ItemMedia className="text-muted-foreground">{icon}</ItemMedia>
				<ItemContent className="flex min-w-0 flex-1 flex-row items-center gap-1.5">
					{title}
				</ItemContent>
				{meta ? (
					<span className="text-muted-foreground text-[length:var(--m-text-footnote)]">
						{meta}
					</span>
				) : null}
				{value ? (
					<span className="font-mono text-[13px] font-medium">{value}</span>
				) : null}
				<ItemActions>
					<Trailing aria-hidden />
				</ItemActions>
			</button>
		</Item>
	);
}

interface FeedRowProps {
	amount?: ReactNode;
	amountClassName?: string;
	badge?: ReactNode;
	icon?: ReactNode;
	meta?: ReactNode;
	onClick?: () => void;
	title: ReactNode;
	titleClassName?: string;
	trailing?: "chevron" | "dots" | null;
}

export function FeedRow({
	amount,
	amountClassName,
	badge,
	icon,
	meta,
	onClick,
	title,
	titleClassName,
	trailing = null,
}: FeedRowProps) {
	const Trailing = trailing === "dots" ? IconDots : IconChevronRight;
	const content = (
		<>
			{icon ? (
				<span className="text-muted-foreground flex flex-none [&_svg]:size-4">
					{icon}
				</span>
			) : null}
			<span className="flex min-w-0 flex-1 flex-col gap-px">
				<span
					className={cn(
						"flex min-w-0 items-center gap-1.5 truncate font-medium",
						titleClassName
					)}
				>
					{title}
				</span>
				{meta || badge ? (
					<span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[length:var(--m-text-footnote)]">
						<span className="truncate">{meta}</span>
						{badge}
					</span>
				) : null}
			</span>
			{amount ? (
				<span
					className={cn(
						"flex-none font-mono text-[13px] font-medium",
						amountClassName
					)}
				>
					{amount}
				</span>
			) : null}
			{trailing ? (
				<Trailing
					aria-hidden
					className="text-muted-foreground size-4 flex-none"
				/>
			) : null}
		</>
	);
	const className =
		"border-border text-foreground flex min-h-12 w-full items-center gap-2.5 border-t px-3.5 py-[5px] text-left";
	return onClick ? (
		<button
			className={cn(
				className,
				"hover:layer-accent active:layer-accent-pressed cursor-pointer outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
			)}
			onClick={onClick}
			type="button"
		>
			{content}
		</button>
	) : (
		<div className={className}>{content}</div>
	);
}

export function FeedHeading({ children }: { children: ReactNode }) {
	return (
		<h3 className="border-border text-muted-foreground m-0 border-t px-3.5 pt-3.5 pb-1 text-[11px] font-semibold tracking-[var(--tracking-caps)] uppercase">
			{children}
		</h3>
	);
}

export function EmptyBlock({
	bordered = false,
	icon,
	title,
}: {
	bordered?: boolean;
	icon: ReactNode;
	title: string;
}) {
	return (
		<div className={cn("px-3.5 py-6", bordered && "border-border border-t")}>
			<Empty className="p-0">
				<EmptyHeader>
					<EmptyMedia>{icon}</EmptyMedia>
					<EmptyTitle>{title}</EmptyTitle>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
