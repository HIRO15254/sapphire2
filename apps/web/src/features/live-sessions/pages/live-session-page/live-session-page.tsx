import { IconCircleX, IconPlayerRecord } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { CashCockpit } from "./cash-cockpit";
import { CRYST_ALERT, crystButton } from "./cryst-controls";
import { CrystEmptyState } from "./cryst-empty-state";
import { CRYST_SCOPE_CLASS } from "./cryst-scope";
import { TournamentCockpit } from "./tournament-cockpit";
import { useLiveSessionPage } from "./use-live-session-page";

function CrystScreen({ children }: { children: React.ReactNode }) {
	return (
		<div
			className={`${CRYST_SCOPE_CLASS} mx-auto flex h-svh w-full max-w-[412px] flex-col bg-background pt-[env(safe-area-inset-top)] font-sans text-foreground tracking-[var(--tracking-body)]`}
		>
			{children}
		</div>
	);
}

const SESSIONS_LINK_CLASS = crystButton({ size: "sm", variant: "outline" });

const SKELETON =
	"block rounded-md bg-muted animate-pulse [animation-duration:1.6s] motion-reduce:animate-none";

function CockpitSkeleton() {
	return (
		<output
			aria-label="Loading the active session"
			className="flex flex-1 flex-col gap-2.5 px-[var(--m-inset)] py-3"
		>
			<span aria-hidden className={cn(SKELETON, "mx-8 h-44 rounded-[48px]")} />
			<span
				aria-hidden
				className={cn(SKELETON, "min-h-16 flex-1 rounded-lg")}
			/>
			<span
				aria-hidden
				className={cn(SKELETON, "h-[var(--m-control)] rounded-lg")}
			/>
			<span aria-hidden className="grid grid-cols-4 gap-2">
				<span className={cn(SKELETON, "h-12 rounded-lg")} />
				<span className={cn(SKELETON, "h-12 rounded-lg")} />
				<span className={cn(SKELETON, "h-12 rounded-lg")} />
				<span className={cn(SKELETON, "h-12 rounded-lg")} />
			</span>
		</output>
	);
}

function CrystMessageScreen({ children }: { children: React.ReactNode }) {
	return (
		<CrystScreen>
			<div className="flex flex-1 items-center justify-center p-4">
				{children}
			</div>
		</CrystScreen>
	);
}

export function LiveSessionPage() {
	const { activeSession, isError, isLoading, onRetry } = useLiveSessionPage();

	if (isLoading) {
		return (
			<CrystScreen>
				<CockpitSkeleton />
			</CrystScreen>
		);
	}

	if (isError) {
		return (
			<CrystMessageScreen>
				<div
					className={cn(
						CRYST_ALERT,
						"grid w-full grid-cols-[auto_1fr] gap-2.5 px-3.5 py-3"
					)}
					role="alert"
				>
					<IconCircleX className="mt-px text-destructive" size={16} />
					<div className="min-w-0">
						<p className="font-semibold tracking-[var(--tracking-heading)]">
							Unable to load the active session
						</p>
						<div className="mt-2.5 flex gap-2">
							<button
								className={crystButton({ size: "sm", variant: "outline" })}
								onClick={onRetry}
								type="button"
							>
								Retry
							</button>
							<Link className={SESSIONS_LINK_CLASS} to="/sessions">
								Go to sessions
							</Link>
						</div>
					</div>
				</div>
			</CrystMessageScreen>
		);
	}

	if (!activeSession) {
		return (
			<CrystMessageScreen>
				<CrystEmptyState
					action={
						<Link className={SESSIONS_LINK_CLASS} to="/sessions">
							Go to sessions
						</Link>
					}
					description="Start a live session from the sessions screen."
					icon={IconPlayerRecord}
					title="No active session"
				/>
			</CrystMessageScreen>
		);
	}

	return (
		<CrystScreen>
			{activeSession.type === "tournament" ? (
				<TournamentCockpit sessionId={activeSession.id} />
			) : (
				<CashCockpit sessionId={activeSession.id} />
			)}
		</CrystScreen>
	);
}
