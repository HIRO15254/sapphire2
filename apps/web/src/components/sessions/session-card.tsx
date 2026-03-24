import {
	IconCalendar,
	IconDotsVertical,
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
		currencyUnit: string | null;
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
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}/${m}/${day}`;
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
	currencyUnit: string | null
): string {
	const sign = profitLoss >= 0 ? "+" : "";
	const value = formatCompactNumber(profitLoss);
	if (currencyUnit) {
		return `${sign}${value} ${currencyUnit}`;
	}
	return `${sign}${value}`;
}

export function SessionCard({ session, onEdit, onDelete }: SessionCardProps) {
	const [showActions, setShowActions] = useState(false);
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

	const handleCardTap = () => {
		if (confirmingDelete) {
			return;
		}
		setShowActions((prev) => !prev);
	};

	return (
		<div className="group rounded-lg border bg-card">
			<div className="flex items-start gap-2 p-3">
				<div className="min-w-0 flex-1">
					{/* Row 1: Game name + badges ... P&L */}
					<div className="flex items-center gap-1.5">
						<span className="truncate font-medium text-sm">{gameName}</span>
						<span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
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
							{formatProfitLoss(profitLoss, session.currencyUnit)}
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
						<p className="mt-0.5 truncate text-muted-foreground text-xs">
							{session.memo}
						</p>
					)}

					{/* Row 3: Store + Date with icons */}
					<div className="mt-1 flex items-center gap-3 text-muted-foreground text-xs">
						{session.storeName && (
							<span className="flex max-w-[120px] items-center gap-0.5">
								<IconMapPin className="shrink-0" size={12} />
								<span className="truncate">{session.storeName}</span>
							</span>
						)}
						<span className="flex items-center gap-0.5">
							<IconCalendar className="shrink-0" size={12} />
							{formatSessionDate(session.sessionDate)}
						</span>
					</div>
				</div>

				{/* Desktop: hover-reveal action buttons */}
				<div className="hidden shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
					<Button
						aria-label="Edit session"
						onClick={(e) => {
							e.stopPropagation();
							onEdit(session);
						}}
						size="icon-xs"
						variant="ghost"
					>
						<IconEdit size={14} />
					</Button>
					<Button
						aria-label="Delete session"
						onClick={(e) => {
							e.stopPropagation();
							setConfirmingDelete(true);
							setShowActions(false);
						}}
						size="icon-xs"
						variant="ghost"
					>
						<IconTrash size={14} />
					</Button>
				</div>

				{/* Mobile: three-dot menu toggle */}
				<Button
					aria-label="Session actions"
					className="shrink-0 text-muted-foreground md:hidden"
					onClick={(e) => {
						e.stopPropagation();
						handleCardTap();
					}}
					size="icon-xs"
					variant="ghost"
				>
					<IconDotsVertical size={14} />
				</Button>
			</div>

			{/* Mobile action bar (shown on tap) */}
			{showActions && !confirmingDelete && (
				<div className="flex items-center justify-end gap-1 border-t px-3 py-1.5 md:hidden">
					<Button
						onClick={(e) => {
							e.stopPropagation();
							onEdit(session);
							setShowActions(false);
						}}
						size="xs"
						variant="ghost"
					>
						<IconEdit size={14} />
						Edit
					</Button>
					<Button
						className="text-destructive hover:text-destructive"
						onClick={(e) => {
							e.stopPropagation();
							setConfirmingDelete(true);
							setShowActions(false);
						}}
						size="xs"
						variant="ghost"
					>
						<IconTrash size={14} />
						Delete
					</Button>
				</div>
			)}

			{/* Delete confirmation bar */}
			{confirmingDelete && (
				<div className="flex items-center justify-end gap-1 border-t px-3 py-1.5">
					<span className="text-destructive text-xs">Delete this session?</span>
					<Button
						aria-label="Confirm delete"
						className="text-destructive hover:text-destructive"
						onClick={(e) => {
							e.stopPropagation();
							onDelete(session.id);
							setConfirmingDelete(false);
						}}
						size="xs"
						variant="ghost"
					>
						<IconTrash size={14} />
						Delete
					</Button>
					<Button
						aria-label="Cancel delete"
						onClick={(e) => {
							e.stopPropagation();
							setConfirmingDelete(false);
						}}
						size="xs"
						variant="ghost"
					>
						<IconX size={14} />
						Cancel
					</Button>
				</div>
			)}
		</div>
	);
}
