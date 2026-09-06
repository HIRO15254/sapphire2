import { cn } from "@/lib/utils";
import { plToneClass } from "../../cryst-tone";

interface CashTableStatsProps {
	bbText: string;
	displayPL: number | null;
	displayPLFormatted: string;
	evPLFormatted: string | null;
	stackFormatted: string;
}

export function CashTableStats({
	bbText,
	displayPL,
	displayPLFormatted,
	evPLFormatted,
	stackFormatted,
}: CashTableStatsProps) {
	return (
		<>
			<span className="font-mono font-semibold text-[22px] tabular-nums tracking-[-0.02em]">
				{stackFormatted}
			</span>
			<div className="flex gap-2 font-mono text-[length:var(--text-xs)] tabular-nums">
				<span className={cn(plToneClass(displayPL))}>{displayPLFormatted}</span>
				<span className="text-muted-foreground">{bbText}</span>
			</div>
			<span className="text-[11px] text-muted-foreground">
				EV result{" "}
				<span className="font-mono tabular-nums">{evPLFormatted ?? "—"}</span>
			</span>
		</>
	);
}
