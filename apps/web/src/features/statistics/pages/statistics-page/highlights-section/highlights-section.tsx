import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	type HighlightSessionCard,
	type LongestSessionCard,
	useHighlightsSection,
} from "@/features/statistics/pages/statistics-page/highlights-section/use-highlights-section";
import type { StatsSectionContext } from "@/features/statistics/types";
import { cn } from "@/lib/utils";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

function CardLabel({ children }: { children: ReactNode }) {
	return (
		<span className="t-meta text-muted-foreground uppercase tracking-wide">
			{children}
		</span>
	);
}

function SessionHighlightCard({
	label,
	card,
}: {
	card: HighlightSessionCard;
	label: string;
}) {
	return (
		<Card className="gap-1 px-3 py-2.5" size="sm">
			<CardLabel>{label}</CardLabel>
			<Link
				className="flex flex-col gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				params={{ sessionId: card.id }}
				to="/sessions/$sessionId"
			>
				<span
					className={cn(
						"font-mono font-semibold text-lg tabular-nums",
						card.valueColor
					)}
				>
					{card.valueText}
				</span>
				<span className="t-meta text-muted-foreground">{card.dateText}</span>
			</Link>
		</Card>
	);
}

function LongestHighlightCard({ card }: { card: LongestSessionCard }) {
	return (
		<Card className="gap-1 px-3 py-2.5" size="sm">
			<CardLabel>Longest session</CardLabel>
			<Link
				className="flex flex-col gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				params={{ sessionId: card.id }}
				to="/sessions/$sessionId"
			>
				<span className="font-mono font-semibold text-lg tabular-nums">
					{card.durationText}
				</span>
				<span className="t-meta text-muted-foreground">{card.dateText}</span>
			</Link>
		</Card>
	);
}

function StreakCard({ label, value }: { label: string; value: number }) {
	return (
		<Card className="gap-1 px-3 py-2.5" size="sm">
			<CardLabel>{label}</CardLabel>
			<span className="font-mono font-semibold text-lg tabular-nums">
				{value}
			</span>
		</Card>
	);
}

export function HighlightsSection({ ctx }: { ctx: StatsSectionContext }) {
	const {
		best,
		worst,
		longest,
		currentWinStreak,
		currentLoseStreak,
		maxWinStreak,
		maxLoseStreak,
		isEmpty,
		isPending,
	} = useHighlightsSection(ctx);

	if (isPending) {
		return (
			<div className="grid grid-cols-3 gap-2">
				{["a", "b", "c", "d", "e", "f", "g"].map((k) => (
					<Skeleton className="h-[60px] rounded-xl" key={k} />
				))}
			</div>
		);
	}

	if (isEmpty) {
		return null;
	}

	return (
		<div className="grid grid-cols-3 gap-2">
			{best && <SessionHighlightCard card={best} label="Best session" />}
			{worst && <SessionHighlightCard card={worst} label="Worst session" />}
			{longest && <LongestHighlightCard card={longest} />}
			<StreakCard label="Current win streak" value={currentWinStreak} />
			<StreakCard label="Current lose streak" value={currentLoseStreak} />
			<StreakCard label="Max win streak" value={maxWinStreak} />
			<StreakCard label="Max lose streak" value={maxLoseStreak} />
		</div>
	);
}
