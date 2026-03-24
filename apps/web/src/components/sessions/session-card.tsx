import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCompactNumber } from "@/utils/format-number";

interface SessionCardProps {
	onDelete: (id: string) => void;
	onEdit: (session: SessionCardProps["session"]) => void;
	session: {
		id: string;
		type: "cash_game" | "tournament";
		sessionDate: Date | string;
		buyIn: number | null;
		cashOut: number | null;
		profitLoss: number;
		startedAt: Date | string | null;
		endedAt: Date | string | null;
		memo: string | null;
		ringGameName: string | null;
		createdAt: Date | string;
		tags: Array<{ id: string; name: string }>;
	};
}

function formatSessionDate(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatDuration(
	startedAt: Date | string,
	endedAt: Date | string
): string {
	const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
	const end = typeof endedAt === "string" ? new Date(endedAt) : endedAt;
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

export function SessionCard({ session, onEdit, onDelete }: SessionCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const isProfitPositive = session.profitLoss > 0;
	const isProfitNegative = session.profitLoss < 0;

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
							Cash Game
						</span>
						<span className={`font-semibold text-sm ${profitColorClass}`}>
							{isProfitPositive ? "+" : ""}
							{formatCompactNumber(session.profitLoss)}
						</span>
					</div>
					{session.ringGameName && (
						<p className="text-muted-foreground text-xs">
							{session.ringGameName}
						</p>
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
								<span
									className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs"
									key={tag.id}
								>
									{tag.name}
								</span>
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
