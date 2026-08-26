import {
	IconChevronDown,
	IconDotsVertical,
	IconPlayerPause,
	IconPlayerPlay,
	IconPlayerRecordFilled,
	IconSquare,
} from "@tabler/icons-react";
import {
	ActionsDrawer,
	type ActionsDrawerItem,
} from "@/features/live-sessions/components/actions-drawer";
import { Button } from "@/shared/components/ui/button";
import { CRYST_SCOPE } from "@/shared/lib/theme";
import { useSessionHeader } from "./use-session-header";

interface SessionHeaderProps {
	isPaused: boolean;
	menuItems: ActionsDrawerItem[];
	onEnd: () => void;
	onTitleTap?: () => void;
	onTogglePause: () => void;
	startedAt: Date | string | number | null;
	title: string;
}

export function SessionHeader({
	isPaused,
	menuItems,
	onEnd,
	onTitleTap,
	onTogglePause,
	startedAt,
	title,
}: SessionHeaderProps) {
	const { elapsedText, isMenuOpen, onOpenMenu, setIsMenuOpen } =
		useSessionHeader({ startedAt });

	const titleContent = (
		<span className="min-w-0 truncate font-semibold text-sm tracking-[var(--tracking-heading)]">
			{title}
		</span>
	);

	return (
		<header className="flex shrink-0 items-center gap-2 px-4 py-2.5">
			{isPaused ? (
				<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-[11px] text-warning">
					<IconPlayerPause className="size-3" />
					Paused
				</span>
			) : (
				<IconPlayerRecordFilled
					className="size-3 shrink-0 text-destructive"
					data-testid="recording-dot"
				/>
			)}
			{onTitleTap ? (
				<button
					className="flex min-h-8 min-w-0 items-center gap-1 text-foreground hover:text-primary"
					onClick={onTitleTap}
					type="button"
				>
					{titleContent}
					<IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
				</button>
			) : (
				titleContent
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
					<IconPlayerPlay className="size-5" />
				) : (
					<IconPlayerPause className="size-5" />
				)}
			</Button>
			<Button
				aria-label="End session"
				onClick={onEnd}
				size="icon"
				type="button"
				variant="ghost"
			>
				<IconSquare className="size-4.5" />
			</Button>
			{menuItems.length > 0 ? (
				<>
					<Button
						aria-label="Session actions"
						onClick={onOpenMenu}
						size="icon"
						type="button"
						variant="ghost"
					>
						<IconDotsVertical className="size-5" />
					</Button>
					<ActionsDrawer
						contentClassName={CRYST_SCOPE}
						description="More session actions."
						items={menuItems.map((item) => ({
							...item,
							onSelect: () => {
								setIsMenuOpen(false);
								item.onSelect();
							},
						}))}
						onOpenChange={setIsMenuOpen}
						open={isMenuOpen}
						title="Session actions"
					/>
				</>
			) : null}
		</header>
	);
}
