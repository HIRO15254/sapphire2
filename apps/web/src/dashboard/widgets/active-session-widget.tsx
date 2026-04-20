import { IconBolt, IconPokerChip, IconTrophy } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatCompactNumber } from "@/utils/format-number";
import { trpc } from "@/utils/trpc";

type SessionTypeFilter = "all" | "cash_game" | "tournament";

interface ParsedConfig {
	sessionType: SessionTypeFilter;
}

function parseConfig(raw: Record<string, unknown>): ParsedConfig {
	const sessionType =
		raw.sessionType === "cash_game" || raw.sessionType === "tournament"
			? (raw.sessionType as SessionTypeFilter)
			: ("all" as SessionTypeFilter);
	return { sessionType };
}

function formatElapsed(startedAt: string | Date | null): string {
	if (!startedAt) {
		return "—";
	}
	const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
	const diffMs = Date.now() - start.getTime();
	if (diffMs < 0) {
		return "—";
	}
	const totalMinutes = Math.floor(diffMs / 60_000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours === 0) {
		return `${minutes}m`;
	}
	return `${hours}h ${minutes}m`;
}

function useTicker(intervalMs = 30_000): void {
	const [, setTick] = useState(0);
	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), intervalMs);
		return () => clearInterval(id);
	}, [intervalMs]);
}

export function ActiveSessionWidget({ config }: WidgetRenderProps) {
	const parsed = parseConfig(config);
	useTicker();

	const cashQuery = useQuery({
		...trpc.liveCashGameSession.list.queryOptions({
			status: "active",
			limit: 5,
		}),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		enabled: parsed.sessionType !== "tournament",
	});

	const tournamentQuery = useQuery({
		...trpc.liveTournamentSession.list.queryOptions({
			status: "active",
			limit: 5,
		}),
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
		enabled: parsed.sessionType !== "cash_game",
	});

	const isLoading = cashQuery.isLoading || tournamentQuery.isLoading;

	if (isLoading) {
		return (
			<div className="flex flex-col gap-2 p-2">
				<Skeleton className="h-10" />
				<Skeleton className="h-10" />
			</div>
		);
	}

	const cashItems =
		parsed.sessionType === "tournament" ? [] : (cashQuery.data?.items ?? []);
	const tournamentItems =
		parsed.sessionType === "cash_game"
			? []
			: (tournamentQuery.data?.items ?? []);

	if (cashItems.length === 0 && tournamentItems.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center p-4 text-muted-foreground text-sm">
				<IconBolt className="mb-2" size={20} />
				No active sessions
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col gap-1 overflow-auto p-2">
			{cashItems.map((item) => (
				<Link
					className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
					key={item.id}
					params={{
						sessionType: "cash-game",
						sessionId: item.id,
					}}
					to="/live-sessions/$sessionType/$sessionId/events"
				>
					<div className="flex min-w-0 items-center gap-2">
						<IconPokerChip
							className="shrink-0 text-blue-500 dark:text-blue-400"
							size={14}
						/>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium text-sm">
								{item.ringGameName ?? "Cash Game"}
							</span>
							<span className="text-muted-foreground text-xs">
								{formatElapsed(item.startedAt)}
							</span>
						</div>
					</div>
					<span className="shrink-0 font-semibold text-sm">
						{item.latestStackAmount === null
							? "—"
							: formatCompactNumber(item.latestStackAmount)}
					</span>
				</Link>
			))}
			{tournamentItems.map((item) => (
				<Link
					className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
					key={item.id}
					params={{
						sessionType: "tournament",
						sessionId: item.id,
					}}
					to="/live-sessions/$sessionType/$sessionId/events"
				>
					<div className="flex min-w-0 items-center gap-2">
						<IconTrophy
							className="shrink-0 text-yellow-500 dark:text-yellow-400"
							size={14}
						/>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium text-sm">
								{item.tournamentName ?? "Tournament"}
							</span>
							<span className="text-muted-foreground text-xs">
								{formatElapsed(item.startedAt)}
							</span>
						</div>
					</div>
					<span className="shrink-0 font-semibold text-sm">
						{item.latestStackAmount === null
							? "—"
							: formatCompactNumber(item.latestStackAmount)}
					</span>
				</Link>
			))}
		</div>
	);
}

export function ActiveSessionEditForm({
	config,
	onSave,
	onCancel,
}: WidgetEditProps) {
	const parsed = parseConfig(config);
	const [sessionType, setSessionType] = useState<SessionTypeFilter>(
		parsed.sessionType
	);
	const [isSaving, setIsSaving] = useState(false);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await onSave({ sessionType });
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label htmlFor="active-session-type">Session Type</Label>
				<select
					className="rounded-md border bg-background px-3 py-2 text-sm"
					id="active-session-type"
					onChange={(e) => setSessionType(e.target.value as SessionTypeFilter)}
					value={sessionType}
				>
					<option value="all">All</option>
					<option value="cash_game">Cash Game</option>
					<option value="tournament">Tournament</option>
				</select>
			</div>
			<DialogActionRow>
				<Button onClick={onCancel} variant="outline">
					Cancel
				</Button>
				<Button disabled={isSaving} onClick={handleSave}>
					{isSaving ? "Saving..." : "Save"}
				</Button>
			</DialogActionRow>
		</div>
	);
}
