import {
	IconClock,
	IconFlame,
	IconTrendingDown,
	IconTrendingUp,
} from "@tabler/icons-react";
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
		<Card className="gap-1 px-4 py-3" size="sm">
			<CardLabel>{label}</CardLabel>
			<Link
				className="flex flex-col gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				params={{ sessionId: card.id }}
				to="/sessions/$sessionId"
			>
				<span
					className={cn(
						"font-mono font-semibold text-2xl tabular-nums",
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
		<Card className="gap-1 px-4 py-3" size="sm">
			<CardLabel>Longest session</CardLabel>
			<Link
				className="flex flex-col gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				params={{ sessionId: card.id }}
				to="/sessions/$sessionId"
			>
				<span className="flex items-center gap-1.5 font-mono font-semibold text-2xl tabular-nums">
					<IconClock className="size-4 text-muted-foreground" />
					{card.durationText}
				</span>
				<span className="t-meta text-muted-foreground">{card.dateText}</span>
			</Link>
		</Card>
	);
}

function StreakCard({
	label,
	value,
	icon,
}: {
	icon: ReactNode;
	label: string;
	value: number;
}) {
	return (
		<Card className="gap-1 px-4 py-3" size="sm">
			<CardLabel>{label}</CardLabel>
			<span className="flex items-center gap-1.5 font-mono font-semibold text-2xl tabular-nums">
				{icon}
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
			<div className="grid grid-cols-2 gap-3">
				{["a", "b", "c", "d", "e", "f", "g"].map((k) => (
					<Skeleton className="h-[72px] rounded-xl" key={k} />
				))}
			</div>
		);
	}

	if (isEmpty) {
		return null;
	}

	return (
		<div className="grid grid-cols-2 gap-3">
			{best && <SessionHighlightCard card={best} label="Best session" />}
			{worst && <SessionHighlightCard card={worst} label="Worst session" />}
			{longest && <LongestHighlightCard card={longest} />}
			<StreakCard
				icon={<IconFlame className="size-4 text-success" />}
				label="Current win streak"
				value={currentWinStreak}
			/>
			<StreakCard
				icon={<IconFlame className="size-4 text-destructive" />}
				label="Current lose streak"
				value={currentLoseStreak}
			/>
			<StreakCard
				icon={<IconTrendingUp className="size-4 text-success" />}
				label="Max win streak"
				value={maxWinStreak}
			/>
			<StreakCard
				icon={<IconTrendingDown className="size-4 text-destructive" />}
				label="Max lose streak"
				value={maxLoseStreak}
			/>
		</div>
	);
}
