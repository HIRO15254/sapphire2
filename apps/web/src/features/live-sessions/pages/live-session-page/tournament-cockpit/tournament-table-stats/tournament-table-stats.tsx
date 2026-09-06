interface TournamentTableStatsProps {
	avgText: string;
	bbText: string;
	remainText: string;
	stackFormatted: string;
}

export function TournamentTableStats({
	avgText,
	bbText,
	remainText,
	stackFormatted,
}: TournamentTableStatsProps) {
	return (
		<>
			<span className="font-mono font-semibold text-[22px] tabular-nums tracking-[-0.02em]">
				{stackFormatted}
			</span>
			<div className="flex gap-2 font-mono text-[length:var(--text-xs)] tabular-nums">
				<span className="text-muted-foreground">{bbText}</span>
			</div>
			<span className="text-[11px] text-muted-foreground">
				Left <span className="font-mono tabular-nums">{remainText}</span> · Avg{" "}
				<span className="font-mono tabular-nums">{avgText}</span>
			</span>
		</>
	);
}
