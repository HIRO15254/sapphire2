import {
	IconChevronDown,
	IconLink,
	IconPlayerPause,
	IconPlayerPlay,
	IconSquare,
	IconUnlink,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { CRYST_FOCUS_RING, crystButton } from "../cryst-controls";

const ICON_BUTTON_CLASS = crystButton({ size: "icon", variant: "ghost" });

const MASTER_PILL_BASE =
	"inline-flex min-h-[22px] shrink-0 items-center rounded-full border px-[7px]";

const MASTER_LINKED_CLASS =
	"border-border bg-transparent text-muted-foreground";

const MASTER_UNLINKED_CLASS =
	"border-[color-mix(in_oklab,var(--warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--warning)_15%,transparent)] text-warning";

interface SessionHeaderProps {
	elapsed: string;
	isMasterLinked: boolean;
	isPaused: boolean;
	onEndSession: () => void;
	onOpenSession: () => void;
	onPause: () => void;
	onResume: () => void;
	ruleName: string;
}

function MasterPill({ isLinked }: { isLinked: boolean }) {
	const label = isLinked ? "Linked to master" : "Not linked to master";
	return (
		<button
			aria-label={label}
			className={`${MASTER_PILL_BASE} ${isLinked ? MASTER_LINKED_CLASS : MASTER_UNLINKED_CLASS}`}
			title={label}
			type="button"
		>
			{isLinked ? (
				<IconLink aria-hidden size={12} />
			) : (
				<IconUnlink aria-hidden size={12} />
			)}
		</button>
	);
}

export function SessionHeader({
	elapsed,
	isMasterLinked,
	isPaused,
	onEndSession,
	onOpenSession,
	onPause,
	onResume,
	ruleName,
}: SessionHeaderProps) {
	return (
		<header className="flex shrink-0 items-center gap-2 px-4 py-2">
			<button
				aria-label="Session settings"
				className={cn(
					"-mx-1.5 inline-flex min-h-8 min-w-0 max-w-[190px] shrink-0 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-accent",
					CRYST_FOCUS_RING
				)}
				onClick={onOpenSession}
				type="button"
			>
				<span className="min-w-0 truncate font-semibold text-[length:var(--text-sm)] tracking-[var(--tracking-heading)]">
					{ruleName}
				</span>
				<IconChevronDown className="shrink-0 text-muted-foreground" size={13} />
			</button>
			<MasterPill isLinked={isMasterLinked} />
			<span className="flex-1" />
			<span className="shrink-0 font-mono text-[length:var(--text-xs)] text-muted-foreground tabular-nums">
				{elapsed}
			</span>
			<button
				aria-label="Pause / resume"
				className={ICON_BUTTON_CLASS}
				onClick={isPaused ? onResume : onPause}
				title="Pause / resume"
				type="button"
			>
				{isPaused ? (
					<IconPlayerPlay size={18} />
				) : (
					<IconPlayerPause size={18} />
				)}
			</button>
			<button
				aria-label="End session"
				className={ICON_BUTTON_CLASS}
				onClick={onEndSession}
				title="End session"
				type="button"
			>
				<IconSquare size={18} />
			</button>
		</header>
	);
}
