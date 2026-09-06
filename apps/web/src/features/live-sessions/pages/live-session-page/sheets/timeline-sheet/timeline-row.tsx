import type { TimelineRow as TimelineRowModel } from "@/features/live-sessions/utils/timeline-view";
import { EVENT_TONE_MARKER, resolveEventIcon } from "../../event-visuals";

export function TimelineRow({
	onSelect,
	row,
}: {
	onSelect: (id: string) => void;
	row: TimelineRowModel;
}) {
	const RowIcon = resolveEventIcon(row.editorKind, row.eventType);

	return (
		<button
			className="flex w-full gap-2.5 rounded-md text-left"
			onClick={() => onSelect(row.id)}
			type="button"
		>
			<span className="w-10 shrink-0 pt-3 text-right font-mono text-[length:var(--m-text-caption)] text-muted-foreground tabular-nums leading-[var(--m-leading-body)]">
				{row.time}
			</span>
			<span className="relative w-6 shrink-0 self-stretch">
				{row.hasLineAbove ? (
					<span className="absolute top-0 left-1/2 h-2.5 w-px bg-border" />
				) : null}
				{row.hasLineBelow ? (
					<span className="absolute top-8 bottom-0 left-1/2 w-px bg-border" />
				) : null}
				<span
					className={`absolute top-2.5 left-1/2 flex size-[22px] -translate-x-1/2 items-center justify-center rounded-full border ${EVENT_TONE_MARKER[row.tone]}`}
				>
					<RowIcon size={13} />
				</span>
			</span>
			<span className="flex min-w-0 flex-1 items-start gap-2 pt-3 pr-1 pb-3.5">
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
					<span className="shrink-0 pt-px font-medium font-mono text-[length:var(--m-text-secondary)] tabular-nums leading-[var(--m-leading-body)]">
						{row.amount}
					</span>
				)}
			</span>
		</button>
	);
}
