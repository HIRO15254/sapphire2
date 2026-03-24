import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SessionItem {
	addonCost: number | null;
	bountyPrizes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	createdAt: Date | string;
	entryFee: number | null;
	id: string;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number;
	rebuyCost: number | null;
	rebuyCount: number | null;
	sessionDate: Date | string;
	totalEntries: number | null;
	tournamentBuyIn: number | null;
	type: string;
}

interface SessionCardProps {
	onDelete: (id: string) => void;
	onEdit: (session: SessionItem) => void;
	session: SessionItem;
}

function formatDate(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatPL(pl: number): string {
	const prefix = pl >= 0 ? "+" : "";
	return `${prefix}${pl.toLocaleString()}`;
}

function computeTournamentTotalCost(session: SessionItem): number {
	return (
		(session.tournamentBuyIn ?? 0) +
		(session.entryFee ?? 0) +
		(session.rebuyCount ?? 0) * (session.rebuyCost ?? 0) +
		(session.addonCost ?? 0)
	);
}

export function SessionCard({ session, onEdit, onDelete }: SessionCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const isCashGame = session.type === "cash_game";
	const pl = session.profitLoss;

	return (
		<div className="rounded-lg border bg-card p-3">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-1.5">
						<Badge variant={isCashGame ? "secondary" : "outline"}>
							{isCashGame ? "Cash Game" : "Tournament"}
						</Badge>
						<span className="text-muted-foreground text-sm">
							{formatDate(session.sessionDate)}
						</span>
					</div>

					<p
						className={`mt-1 font-semibold text-lg ${pl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
					>
						{formatPL(pl)}
					</p>

					{isCashGame && (
						<p className="text-muted-foreground text-sm">
							Buy-in: {(session.buyIn ?? 0).toLocaleString()} / Cash-out:{" "}
							{(session.cashOut ?? 0).toLocaleString()}
						</p>
					)}

					{!isCashGame && (
						<div className="text-muted-foreground text-sm">
							{session.placement != null && session.totalEntries != null && (
								<p>
									{session.placement}/{session.totalEntries} place
								</p>
							)}
							<p>
								Total cost:{" "}
								{computeTournamentTotalCost(session).toLocaleString()}
								{session.prizeMoney != null && session.prizeMoney > 0 && (
									<> / Prize: {session.prizeMoney.toLocaleString()}</>
								)}
							</p>
						</div>
					)}
				</div>

				<div className="flex shrink-0 items-center gap-1">
					{confirmingDelete ? (
						<>
							<span className="text-destructive text-xs">Delete?</span>
							<Button
								aria-label="Confirm delete"
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
