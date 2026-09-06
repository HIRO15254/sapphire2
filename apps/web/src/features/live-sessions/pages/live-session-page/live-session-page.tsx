import { QueryError } from "@/shared/components/query-error";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { CashCockpit } from "./cash-cockpit";
import { CRYST_SCOPE_CLASS } from "./cryst-scope";
import { CrystHeaderShell } from "./session-header";
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

function CrystMessageScreen({ children }: { children: React.ReactNode }) {
	return (
		<CrystScreen>
			<CrystHeaderShell />
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
			<CrystMessageScreen>
				<EmptyState
					className="border-none bg-transparent py-0"
					description="Fetching the current active session."
					heading="Loading..."
				/>
			</CrystMessageScreen>
		);
	}

	if (isError) {
		return (
			<CrystMessageScreen>
				<QueryError
					message="Unable to load the active session"
					onRetry={onRetry}
				/>
			</CrystMessageScreen>
		);
	}

	if (!activeSession) {
		return (
			<CrystMessageScreen>
				<EmptyState
					className="border-none bg-transparent py-0"
					description="Start a live session from the sessions screen."
					heading="No active session"
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
