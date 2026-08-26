import { cn } from "@/lib/utils";

export interface TimelineItemViewModel {
	amountClass: string | null;
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
			className="group flex w-full items-start gap-3 rounded-[var(--radius-md)] py-2 text-left hover:bg-muted/50"
			data-testid={`timeline-item-${item.id}`}
			onClick={item.onEdit}
			type="button"
		>
			<span className="w-10 shrink-0 pt-0.5 text-right font-mono text-muted-foreground text-xs">
				{item.time}
			</span>
			<span className="relative flex w-3 shrink-0 justify-center self-stretch">
				<span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
				<span
					className={cn(
						"relative z-10 mt-1 size-[7px] shrink-0 rounded-full border-2 border-background",
						item.dotClass
					)}
				/>
			</span>
			<span className="min-w-0 flex-1 py-0.5">
				<span className="block text-sm">{item.title}</span>
				{item.sub ? (
					<span className="mt-0.5 block text-muted-foreground text-xs">
						{item.sub}
					</span>
				) : null}
			</span>
			{item.amountText ? (
				<span
					className={cn(
						"shrink-0 self-center pl-2 text-right font-mono text-sm",
						item.amountClass
					)}
				>
					{item.amountText}
				</span>
			) : null}
		</button>
	);
}
