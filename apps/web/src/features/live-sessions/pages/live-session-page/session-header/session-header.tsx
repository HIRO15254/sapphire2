import {
	IconLink,
	IconPlayerPause,
	IconPlayerPlay,
	IconPlayerRecordFilled,
	IconSquare,
	IconUnlink,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";

interface SessionHeaderProps {
	elapsed: string;
	isMasterLinked: boolean;
	isPaused: boolean;
	onEndSession: () => void;
	onPause: () => void;
	onResume: () => void;
	ruleName: string;
}

function StatusIndicator({ isPaused }: { isPaused: boolean }) {
	if (isPaused) {
		return (
			<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--warning)_15%,transparent)] px-2 py-0.5 font-semibold text-[11px] text-warning">
				<IconPlayerPause size={11} />
				Paused
			</span>
		);
	}
	return (
		<IconPlayerRecordFilled
			aria-label="Recording"
			className="shrink-0 text-destructive"
			role="img"
			size={11}
		/>
	);
}

function MasterPill({ isLinked }: { isLinked: boolean }) {
	if (isLinked) {
		return (
			<span
				aria-label="Linked to a master ring game"
				className="inline-flex min-h-[22px] shrink-0 items-center rounded-full border border-border px-[7px] text-muted-foreground"
				role="img"
			>
				<IconLink size={11} />
			</span>
		);
	}
	return (
		<span className="inline-flex min-h-[22px] max-w-24 shrink-0 items-center gap-1 truncate rounded-full bg-[color-mix(in_oklab,var(--warning)_15%,transparent)] px-[7px] font-semibold text-[11px] text-warning">
			<IconUnlink size={11} />
			Link
		</span>
	);
}

export function SessionHeader({
	elapsed,
	isMasterLinked,
	isPaused,
	onEndSession,
	onPause,
	onResume,
	ruleName,
}: SessionHeaderProps) {
	return (
		<header className="flex h-14 shrink-0 items-center gap-2 px-4 py-2.5">
			<StatusIndicator isPaused={isPaused} />
			<span
				className={cn(
					"min-w-0 max-w-[190px] truncate font-semibold",
					"text-[length:var(--text-sm)] tracking-[var(--tracking-heading)]"
				)}
			>
				{ruleName}
			</span>
			<MasterPill isLinked={isMasterLinked} />
			<span className="ml-auto shrink-0 font-mono text-[length:var(--text-xs)] text-muted-foreground tabular-nums">
				{elapsed}
			</span>
			<Button
				aria-label={isPaused ? "Resume session" : "Pause session"}
				className="size-9 shrink-0"
				onClick={isPaused ? onResume : onPause}
				size="icon"
				type="button"
				variant="ghost"
			>
				{isPaused ? (
					<IconPlayerPlay size={18} />
				) : (
					<IconPlayerPause size={18} />
				)}
			</Button>
			<Button
				aria-label="End session"
				className="size-9 shrink-0"
				onClick={onEndSession}
				size="icon"
				type="button"
				variant="ghost"
			>
				<IconSquare size={18} />
			</Button>
		</header>
	);
}
