import type {
	TimelineRow as TimelineRowModel,
	TimelineTone,
} from "@/features/live-sessions/utils/timeline-view";

const DOT_TONE: Record<TimelineTone, string> = {
	destructive: "bg-destructive",
	info: "bg-info",
	muted: "bg-muted-foreground",
	primary: "bg-primary",
	success: "bg-success",
	warning: "bg-warning",
};

export function TimelineRow({
	onSelect,
	row,
}: {
	onSelect: (id: string) => void;
	row: TimelineRowModel;
}) {
	return (
		<button
			className="flex w-full gap-2.5 rounded-md text-left"
			onClick={() => onSelect(row.id)}
			type="button"
		>
			<span className="w-10 shrink-0 pt-[11px] text-right font-mono text-[length:var(--m-text-caption)] text-muted-foreground tabular-nums leading-[var(--m-leading-body)]">
				{row.time}
			</span>
			<span className="relative w-3.5 shrink-0 self-stretch">
				<span className="absolute inset-y-0 left-1/2 w-px bg-border" />
				<span
					className={`absolute top-[15px] left-1/2 size-[7px] -translate-x-1/2 rounded-full border-2 border-background ${DOT_TONE[row.tone]}`}
				/>
			</span>
			<span className="flex min-w-0 flex-1 items-start gap-2 pt-[9px] pr-1 pb-[11px]">
				<span className="min-w-0 flex-1">
					<span className="block text-[length:var(--m-text-secondary)] leading-[var(--m-leading-body)]">
						{row.title}
					</span>
					{row.sub === null ? null : (
						<span className="mt-0.5 block text-[length:var(--m-text-caption)] text-muted-foreground leading-[var(--m-leading-body)]">
							{row.sub}
						</span>
					)}
				</span>
				{row.amount === null ? null : (
					<span className="shrink-0 font-medium font-mono text-[length:var(--m-text-secondary)] tabular-nums leading-[var(--m-leading-body)]">
						{row.amount}
					</span>
				)}
			</span>
		</button>
	);
}
