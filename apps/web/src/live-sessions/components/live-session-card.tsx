import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/lib/utils";

interface LiveSessionCardProps {
	onClick: (id: string) => void;
	session: {
		id: string;
		type: "cash_game" | "tournament";
		status: "active" | "completed";
		storeName: string | null;
		gameName: string | null;
		currencyName: string | null;
		startedAt: string;
		endedAt: string | null;
		memo: string | null;
		eventCount: number;
	};
}

const MEMO_MAX_LENGTH = 60;

function formatStartTime(isoString: string): string {
	const date = new Date(isoString);
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const h = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	return `${y}/${m}/${d} ${h}:${min}`;
}

function truncateMemo(memo: string): string {
	if (memo.length <= MEMO_MAX_LENGTH) {
		return memo;
	}
	return `${memo.slice(0, MEMO_MAX_LENGTH)}…`;
}

function TypeBadge({ type }: { type: "cash_game" | "tournament" }) {
	const isTournament = type === "tournament";
	return (
		<Badge
			className={cn(
				"shrink-0",
				isTournament
					? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
					: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
			)}
			variant="outline"
		>
			{isTournament ? "Tournament" : "Cash Game"}
		</Badge>
	);
}

function StatusBadge({ status }: { status: "active" | "completed" }) {
	const classMap: Record<string, string> = {
		active:
			"border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400",
		completed: "border-border bg-muted text-muted-foreground",
	};
	const labelMap: Record<string, string> = {
		active: "Active",
		completed: "Completed",
	};
	return (
		<Badge className={cn("shrink-0", classMap[status])} variant="outline">
			{labelMap[status]}
		</Badge>
	);
}

export function LiveSessionCard({ session, onClick }: LiveSessionCardProps) {
	return (
		<Button
			className="h-auto w-full justify-start p-0 text-left hover:bg-transparent"
			onClick={() => onClick(session.id)}
			type="button"
			variant="ghost"
		>
			<Card className="transition-colors hover:bg-muted/50">
				<CardContent className="flex flex-col gap-2">
					{/* Badges row */}
					<div className="flex flex-wrap items-center gap-1.5">
						<TypeBadge type={session.type} />
						<StatusBadge status={session.status} />
					</div>

					{/* Main info */}
					<div className="flex flex-col gap-0.5">
						{session.gameName && (
							<span className="font-medium text-sm leading-snug">
								{session.gameName}
							</span>
						)}
						{session.storeName && (
							<span className="text-muted-foreground text-xs">
								{session.storeName}
							</span>
						)}
					</div>

					{/* Meta row */}
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
						<span>{formatStartTime(session.startedAt)}</span>
						<span>
							{session.eventCount}{" "}
							{session.eventCount === 1 ? "event" : "events"}
						</span>
						{session.currencyName && <span>{session.currencyName}</span>}
					</div>

					{/* Memo excerpt */}
					{session.memo && (
						<p className="text-muted-foreground text-xs leading-relaxed">
							{truncateMemo(session.memo)}
						</p>
					)}
				</CardContent>
			</Card>
		</Button>
	);
}
