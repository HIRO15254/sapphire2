import {
	IconChevronDown,
	IconPlayerPause,
	IconPlayerPlay,
	IconPlayerRecordFilled,
	IconSquare,
} from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { useSessionHeader } from "./use-session-header";

interface SessionHeaderProps {
	isPaused: boolean;
	onEnd: () => void;
	onTitleTap?: () => void;
	onTogglePause: () => void;
	startedAt: Date | string | number | null;
	title: string;
}

export function SessionHeader({
	isPaused,
	onEnd,
	onTitleTap,
	onTogglePause,
	startedAt,
	title,
}: SessionHeaderProps) {
	const { elapsedText } = useSessionHeader({ startedAt });

	const titleContent = (
		<span className="min-w-0 truncate font-semibold text-sm tracking-[var(--tracking-heading)]">
			{title}
		</span>
	);

	return (
		<header className="flex shrink-0 items-center gap-2 px-4 py-2.5">
			{isPaused ? (
				<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-[11px] text-warning">
					<IconPlayerPause size={11} />
					Paused
				</span>
			) : (
				<IconPlayerRecordFilled
					className="shrink-0 text-destructive"
					data-testid="recording-dot"
					size={11}
				/>
			)}
			{onTitleTap ? (
				<button
					className="flex min-h-8 max-w-[190px] shrink-0 items-center gap-1 text-foreground hover:text-primary"
					onClick={onTitleTap}
					type="button"
				>
					{titleContent}
					<IconChevronDown
						className="shrink-0 text-muted-foreground"
						size={13}
					/>
				</button>
			) : (
				<span className="flex max-w-[190px] shrink-0 items-center">
					{titleContent}
				</span>
			)}
			<span className="flex-1" />
			<span className="font-mono text-muted-foreground text-xs tabular-nums">
				{elapsedText}
			</span>
			<Button
				aria-label={isPaused ? "Resume session" : "Pause session"}
				onClick={onTogglePause}
				size="icon"
				type="button"
				variant="ghost"
			>
				{isPaused ? (
					<IconPlayerPlay size={16} />
				) : (
					<IconPlayerPause size={16} />
				)}
			</Button>
			<Button
				aria-label="End session"
				onClick={onEnd}
				size="icon"
				type="button"
				variant="ghost"
			>
				<IconSquare size={16} />
			</Button>
		</header>
	);
}
