import { cn } from "@/lib/utils";

export interface TimelineItemViewModel {
	amountText: string | null;
	dotClass: string;
	id: string;
	onEdit: () => void;
	sub: string | null;
	time: string;
	title: string;
}

interface TimelineItemProps {
	item: TimelineItemViewModel;
}

export function TimelineItem({ item }: TimelineItemProps) {
	return (
		<button
			className="flex w-full gap-2.5 rounded-[var(--radius-md)] text-left font-sans text-foreground tracking-[var(--tracking-body)] hover:bg-muted"
			data-testid={`timeline-item-${item.id}`}
			onClick={item.onEdit}
			type="button"
		>
			<span className="w-10 shrink-0 pt-[11px] text-right font-mono text-[var(--m-text-caption)] text-muted-foreground leading-[var(--m-leading-body)]">
				{item.time}
			</span>
			<span className="relative w-3.5 shrink-0 self-stretch">
				<span className="absolute inset-y-0 left-1/2 w-px bg-border" />
				<span
					className={cn(
						"absolute top-[15px] left-1/2 size-[7px] -translate-x-1/2 rounded-full border-2 border-background",
						item.dotClass
					)}
				/>
			</span>
			<span className="flex min-w-0 flex-1 items-start gap-2 pt-[9px] pr-1 pb-[11px]">
				<span className="min-w-0 flex-1">
					<span className="block font-normal text-[var(--m-text-secondary)] leading-[var(--m-leading-body)]">
						{item.title}
					</span>
					{item.sub ? (
						<span className="mt-0.5 block text-[var(--m-text-caption)] text-muted-foreground leading-[var(--m-leading-body)]">
							{item.sub}
						</span>
					) : null}
				</span>
				{item.amountText ? (
					<span className="shrink-0 font-medium font-mono text-[var(--m-text-secondary)] text-foreground leading-[var(--m-leading-body)]">
						{item.amountText}
					</span>
				) : null}
			</span>
		</button>
	);
}
