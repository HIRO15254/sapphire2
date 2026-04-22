import { IconBolt, IconPokerChip, IconTrophy } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/features/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useElapsedTime } from "@/shared/hooks/use-elapsed-time";
import { formatCompactNumber } from "@/utils/format-number";
import {
	type ActiveSessionWidgetSessionType,
	parseActiveSessionWidgetConfig,
	useActiveSessionWidget,
} from "./use-active-session-widget";

interface ActiveSessionRowProps {
	latestStackAmount: number | null;
	name: string;
	sessionId: string;
	sessionType: "cash-game" | "tournament";
	startedAt: string | Date | null;
}

function ActiveSessionRow({
	sessionType,
	sessionId,
	name,
	startedAt,
	latestStackAmount,
}: ActiveSessionRowProps) {
	const elapsed = useElapsedTime(startedAt, 30_000);
	return (
		<Link
			className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
			params={{ sessionType, sessionId }}
			to="/live-sessions/$sessionType/$sessionId/events"
		>
			<div className="flex min-w-0 items-center gap-2">
				{sessionType === "tournament" ? (
					<IconTrophy
						className="shrink-0 text-yellow-500 dark:text-yellow-400"
						size={14}
					/>
				) : (
					<IconPokerChip
						className="shrink-0 text-blue-500 dark:text-blue-400"
						size={14}
					/>
				)}
				<div className="flex min-w-0 flex-col">
					<span className="truncate font-medium text-sm">{name}</span>
					<span className="text-muted-foreground text-xs">{elapsed}</span>
				</div>
			</div>
			<span className="shrink-0 font-semibold text-sm">
				{latestStackAmount === null
					? "—"
					: formatCompactNumber(latestStackAmount)}
			</span>
		</Link>
	);
}

export function ActiveSessionWidget({ config }: WidgetRenderProps) {
	const { isLoading, cashItems, tournamentItems } =
		useActiveSessionWidget(config);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-2 p-2">
				<Skeleton className="h-10" />
				<Skeleton className="h-10" />
			</div>
		);
	}

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
				<ActiveSessionRow
					key={item.id}
					latestStackAmount={item.latestStackAmount}
					name={item.ringGameName ?? "Cash Game"}
					sessionId={item.id}
					sessionType="cash-game"
					startedAt={item.startedAt}
				/>
			))}
			{tournamentItems.map((item) => (
				<ActiveSessionRow
					key={item.id}
					latestStackAmount={item.latestStackAmount}
					name={item.tournamentName ?? "Tournament"}
					sessionId={item.id}
					sessionType="tournament"
					startedAt={item.startedAt}
				/>
			))}
		</div>
	);
}

export function ActiveSessionEditForm({
	config,
	onSave,
	onCancel,
}: WidgetEditProps) {
	const parsed = parseActiveSessionWidgetConfig(config);
	const [sessionType, setSessionType] =
		useState<ActiveSessionWidgetSessionType>(parsed.sessionType);
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
					onChange={(e) =>
						setSessionType(e.target.value as ActiveSessionWidgetSessionType)
					}
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
