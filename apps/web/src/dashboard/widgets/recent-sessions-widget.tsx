import { IconPokerChip, IconTrophy } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatYmdSlash } from "@/utils/format-number";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";
import { trpc } from "@/utils/trpc";

type TypeFilter = "all" | "cash_game" | "tournament";

interface ParsedConfig {
	limit: number;
	type: TypeFilter;
}

function parseConfig(raw: Record<string, unknown>): ParsedConfig {
	const limit =
		typeof raw.limit === "number" && raw.limit > 0 && raw.limit <= 20
			? Math.floor(raw.limit)
			: 5;
	const type =
		raw.type === "cash_game" || raw.type === "tournament"
			? (raw.type as TypeFilter)
			: ("all" as TypeFilter);
	return { limit, type };
}

export function RecentSessionsWidget({ config }: WidgetRenderProps) {
	const parsed = parseConfig(config);
	const query = useQuery(
		trpc.session.list.queryOptions({
			type: parsed.type === "all" ? undefined : parsed.type,
		})
	);

	if (query.isLoading) {
		return (
			<div className="flex flex-col gap-2 p-2">
				{Array.from({ length: parsed.limit }, (_, i) => i).map((i) => (
					<Skeleton className="h-10" key={i} />
				))}
			</div>
		);
	}

	const items = (query.data?.items ?? []).slice(0, parsed.limit);
	if (items.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
				No sessions yet
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col gap-1 overflow-auto p-2">
			{items.map((session) => {
				const isTournament = session.type === "tournament";
				const name = isTournament
					? (session.tournamentName ?? "Tournament")
					: (session.ringGameName ?? "Cash Game");
				return (
					<Link
						className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
						key={session.id}
						to="/sessions"
					>
						<div className="flex min-w-0 items-center gap-2">
							{isTournament ? (
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
								<span className="text-muted-foreground text-xs">
									{formatYmdSlash(session.sessionDate)}
								</span>
							</div>
						</div>
						<span
							className={`shrink-0 font-semibold text-sm ${profitLossColorClass(session.profitLoss)}`}
						>
							{formatProfitLoss(session.profitLoss)}
						</span>
					</Link>
				);
			})}
		</div>
	);
}

export function RecentSessionsEditForm({
	config,
	onSave,
	onCancel,
}: WidgetEditProps) {
	const parsed = parseConfig(config);
	const [limit, setLimit] = useState<number>(parsed.limit);
	const [type, setType] = useState<TypeFilter>(parsed.type);
	const [isSaving, setIsSaving] = useState(false);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await onSave({ limit, type });
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label htmlFor="recent-sessions-limit">Number of Sessions</Label>
				<input
					className="rounded-md border bg-background px-3 py-2 text-sm"
					id="recent-sessions-limit"
					max={20}
					min={1}
					onChange={(e) => setLimit(Math.max(1, Number(e.target.value)))}
					type="number"
					value={limit}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="recent-sessions-type">Type</Label>
				<select
					className="rounded-md border bg-background px-3 py-2 text-sm"
					id="recent-sessions-type"
					onChange={(e) => setType(e.target.value as TypeFilter)}
					value={type}
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
