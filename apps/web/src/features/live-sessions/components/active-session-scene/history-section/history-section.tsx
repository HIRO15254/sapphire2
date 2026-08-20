import { IconChevronDown } from "@tabler/icons-react";
import { SessionEventsScene } from "@/features/live-sessions/components/session-events-scene";
import { cn } from "@/lib/utils";
import { useHistorySection } from "./use-history-section";

interface HistorySectionProps {
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}

export function HistorySection({
	sessionId,
	sessionType,
}: HistorySectionProps) {
	const { isOpen, onToggle } = useHistorySection();

	return (
		<section className="rounded-lg border border-border bg-card text-card-foreground">
			<button
				aria-expanded={isOpen}
				className="flex w-full items-center justify-between px-4 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40"
				onClick={onToggle}
				type="button"
			>
				<h2 className="t-h4">History</h2>
				<IconChevronDown
					className={cn(
						"text-muted-foreground transition-transform",
						isOpen && "rotate-180"
					)}
					size={18}
				/>
			</button>
			{isOpen ? (
				<div className="border-border border-t px-4 py-3">
					<SessionEventsScene
						embedded
						refetchInterval={3000}
						sessionId={sessionId}
						sessionType={sessionType}
					/>
				</div>
			) : null}
		</section>
	);
}
