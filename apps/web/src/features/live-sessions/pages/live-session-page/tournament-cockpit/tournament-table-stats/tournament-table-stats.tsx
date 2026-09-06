interface TournamentTableStatsProps {
	averageStackText: string;
	bbText: string;
	fieldText: string;
	stackFormatted: string;
}

export function TournamentTableStats({
	averageStackText,
	bbText,
	fieldText,
	stackFormatted,
}: TournamentTableStatsProps) {
	return (
		<>
			<span className="font-mono font-semibold text-[22px] tabular-nums tracking-[-0.02em]">
				{stackFormatted}
			</span>
			<div className="flex gap-2 font-mono text-[length:var(--text-xs)] tabular-nums">
				<span>{bbText}</span>
				<span className="text-muted-foreground">Avg {averageStackText}</span>
			</div>
			<span className="text-[11px] text-muted-foreground">
				Players <span className="font-mono tabular-nums">{fieldText}</span>
			</span>
		</>
	);
}
