import {
	IconCalendar,
	IconEdit,
	IconMapPin,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCompactNumber } from "@/utils/format-number";

interface SessionCardProps {
	onDelete: (id: string) => void;
	onEdit: (session: SessionCardProps["session"]) => void;
	session: {
		addonCost: number | null;
		bountyPrizes: number | null;
		buyIn: number | null;
		cashOut: number | null;
		createdAt: string;
		currencyId: string | null;
		currencyName: string | null;
		endedAt: string | null;
		entryFee: number | null;
		evCashOut: number | null;
		id: string;
		memo: string | null;
		placement: number | null;
		prizeMoney: number | null;
		profitLoss: number | null;
		rebuyCost: number | null;
		rebuyCount: number | null;
		ringGameId: string | null;
		ringGameName: string | null;
		sessionDate: string;
		startedAt: string | null;
		storeId: string | null;
		storeName: string | null;
		tags: Array<{ id: string; name: string }>;
		totalEntries: number | null;
		tournamentBuyIn: number | null;
		tournamentId: string | null;
		tournamentName: string | null;
		type: string;
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

function getGameName(session: SessionCardProps["session"]): string {
	if (session.type === "tournament" && session.tournamentName) {
		return session.tournamentName;
	}
	if (session.type === "cash_game" && session.ringGameName) {
		return session.ringGameName;
	}
	return session.type === "tournament" ? "Tournament" : "Cash Game";
}

function formatProfitLoss(
	profitLoss: number,
	currencyName: string | null
): string {
	const sign = profitLoss >= 0 ? "+" : "";
	const value = formatCompactNumber(profitLoss);
	if (currencyName) {
		return `${sign}${value} ${currencyName}`;
	}
	return `${sign}${value}`;
}

export function SessionCard({ session, onEdit, onDelete }: SessionCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const profitLoss = session.profitLoss ?? 0;
	const isTournament = session.type === "tournament";

	let profitColorClass = "text-foreground";
	if (profitLoss > 0) {
		profitColorClass = "text-green-600";
	} else if (profitLoss < 0) {
		profitColorClass = "text-red-600";
	}

	const gameName = getGameName(session);

	return (
		<div className="rounded-lg border bg-card">
			<div className="flex items-start gap-2 p-3">
				<div className="min-w-0 flex-1">
					{/* Row 1: Game name + badges ... P&L */}
					<div className="flex items-center gap-2">
						<span className="truncate font-medium text-sm">{gameName}</span>
						<span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
							{isTournament ? "T" : "CG"}
						</span>
						{session.tags.map((tag) => (
							<Badge className="shrink-0" key={tag.id} variant="outline">
								{tag.name}
							</Badge>
						))}
						<span
							className={`ml-auto shrink-0 font-semibold text-sm ${profitColorClass}`}
						>
							{formatProfitLoss(profitLoss, session.currencyName)}
						</span>
					</div>

					{/* Row 2: Tournament placement or memo */}
					{isTournament && session.placement !== null && (
						<p className="mt-0.5 text-muted-foreground text-xs">
							{session.placement}
							{session.totalEntries !== null ? `/${session.totalEntries}` : ""}
							{" place"}
						</p>
					)}
					{!isTournament && session.memo && (
						<p className="mt-0.5 max-w-[250px] truncate text-muted-foreground text-xs">
							{session.memo}
						</p>
					)}

					{/* Row 3: Store + Date with icons */}
					<div className="mt-1 flex items-center gap-3 text-muted-foreground text-xs">
						{session.storeName && (
							<span className="flex items-center gap-0.5">
								<IconMapPin size={12} />
								{session.storeName}
							</span>
						)}
						<span className="flex items-center gap-0.5">
							<IconCalendar size={12} />
							{formatSessionDate(session.sessionDate)}
						</span>
					</div>
				</div>

				{/* Action buttons */}
				<div className="flex shrink-0 items-center gap-1">
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
