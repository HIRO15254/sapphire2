import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCompactNumber } from "@/utils/format-number";

interface SessionCardProps {
	onDelete: (id: string) => void;
	onEdit: (session: SessionCardProps["session"]) => void;
	session: {
		id: string;
		type: string;
		sessionDate: string;
		buyIn: number | null;
		cashOut: number | null;
		tournamentBuyIn: number | null;
		entryFee: number | null;
		placement: number | null;
		totalEntries: number | null;
		prizeMoney: number | null;
		rebuyCount: number | null;
		rebuyCost: number | null;
		addonCost: number | null;
		bountyPrizes: number | null;
		profitLoss: number | null;
		startedAt: string | null;
		endedAt: string | null;
		memo: string | null;
		storeId: string | null;
		storeName: string | null;
		ringGameId: string | null;
		ringGameName: string | null;
		tournamentId: string | null;
		tournamentName: string | null;
		currencyId: string | null;
		currencyName: string | null;
		createdAt: string;
		tags: Array<{ id: string; name: string }>;
	};
}

function formatSessionDate(date: string): string {
	const d = new Date(date);
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatDuration(startedAt: string, endedAt: string): string {
	const start = new Date(startedAt);
	const end = new Date(endedAt);
	const diffMs = end.getTime() - start.getTime();
	const hours = Math.floor(diffMs / (1000 * 60 * 60));
	const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
	if (hours > 0 && minutes > 0) {
		return `${hours}h ${minutes}m`;
	}
	if (hours > 0) {
		return `${hours}h`;
	}
	return `${minutes}m`;
}

function formatTournamentCost(session: SessionCardProps["session"]): string {
	const buyIn = session.tournamentBuyIn ?? 0;
	const entryFee = session.entryFee ?? 0;
	const rebuys = (session.rebuyCount ?? 0) * (session.rebuyCost ?? 0);
	const addon = session.addonCost ?? 0;
	const total = buyIn + entryFee + rebuys + addon;
	return formatCompactNumber(total);
}

export function SessionCard({ session, onEdit, onDelete }: SessionCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const profitLoss = session.profitLoss ?? 0;
	const isProfitPositive = profitLoss > 0;
	const isProfitNegative = profitLoss < 0;
	const isTournament = session.type === "tournament";

	let profitColorClass = "text-foreground";
	if (isProfitPositive) {
		profitColorClass = "text-green-500";
	} else if (isProfitNegative) {
		profitColorClass = "text-red-500";
	}

	return (
		<div className="rounded-lg border bg-card">
			<div className="flex items-center gap-2 p-3">
				<div className="flex-1">
					<p className="font-medium">
						{formatSessionDate(session.sessionDate)}
					</p>
					<div className="mt-0.5 flex items-center gap-2">
						<span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
							{isTournament ? "Tournament" : "Cash Game"}
						</span>
						<span className={`font-semibold text-sm ${profitColorClass}`}>
							{isProfitPositive ? "+" : ""}
							{formatCompactNumber(profitLoss)}
						</span>
					</div>
					{isTournament && (
						<div className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
							{session.placement !== null && (
								<span>
									{session.placement}
									{session.totalEntries !== null
										? `/${session.totalEntries}`
										: ""}
								</span>
							)}
							<span>Cost: {formatTournamentCost(session)}</span>
						</div>
					)}
					{!isTournament && session.ringGameName && (
						<p className="text-muted-foreground text-xs">
							{session.ringGameName}
						</p>
					)}
					{isTournament && session.tournamentName && (
						<p className="text-muted-foreground text-xs">
							{session.tournamentName}
						</p>
					)}
					{(session.storeName || session.currencyName) && (
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							{session.storeName && <span>{session.storeName}</span>}
							{session.storeName && session.currencyName && <span>·</span>}
							{session.currencyName && <span>{session.currencyName}</span>}
						</div>
					)}
					{session.startedAt && session.endedAt && (
						<p className="text-muted-foreground text-xs">
							{formatDuration(session.startedAt, session.endedAt)}
						</p>
					)}
					{session.memo && (
						<p className="max-w-[200px] truncate text-muted-foreground text-xs">
							{session.memo}
						</p>
					)}
					{session.tags.length > 0 && (
						<div className="mt-1 flex flex-wrap gap-1">
							{session.tags.map((tag) => (
								<Badge key={tag.id} variant="outline">
									{tag.name}
								</Badge>
							))}
						</div>
					)}
				</div>

				<div className="flex items-center gap-1">
					{confirmingDelete ? (
						<>
							<span className="text-destructive text-xs">Delete?</span>
							<Button
								aria-label="Confirm delete session"
								className="text-destructive hover:text-destructive"
								onClick={() => {
									onDelete(session.id);
									setConfirmingDelete(false);
								}}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={14} />
							</Button>
							<Button
								aria-label="Cancel delete"
								onClick={() => setConfirmingDelete(false)}
								size="sm"
								variant="ghost"
							>
								<IconX size={14} />
							</Button>
						</>
					) : (
						<>
							<Button
								aria-label="Edit session"
								onClick={() => onEdit(session)}
								size="sm"
								variant="ghost"
							>
								<IconEdit size={14} />
							</Button>
							<Button
								aria-label="Delete session"
								onClick={() => setConfirmingDelete(true)}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={14} />
							</Button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
