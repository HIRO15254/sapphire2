import { IconChevronLeft } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { QueryError } from "@/shared/components/query-error";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { CashCockpit } from "./cash-cockpit";
import { CRYST_SCOPE_CLASS } from "./cryst-scope";
import { useLiveSessionPage } from "./use-live-session-page";

function CrystScreen({ children }: { children: React.ReactNode }) {
	return (
		<div
			className={`${CRYST_SCOPE_CLASS} flex h-svh flex-col bg-background text-foreground`}
		>
			<header className="flex shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
				<Link
					aria-label="Back to sessions"
					className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
					to="/sessions"
				>
					<IconChevronLeft size={20} stroke={1.75} />
				</Link>
			</header>
			<div className="mx-auto flex w-full max-w-[412px] flex-1 flex-col overflow-hidden">
				{children}
			</div>
		</div>
	);
}

export function LiveSessionPage() {
	const { activeSession, isError, isLoading, onRetry } = useLiveSessionPage();

	if (isLoading) {
		return (
			<CrystScreen>
				<div className="flex flex-1 items-center justify-center p-4">
					<EmptyState
						className="border-none bg-transparent py-0"
						description="Fetching the current active session."
						heading="Loading..."
					/>
				</div>
			</CrystScreen>
		);
	}

	if (isError) {
		return (
			<CrystScreen>
				<div className="flex flex-1 items-center justify-center p-4">
					<QueryError
						message="Unable to load the active session"
						onRetry={onRetry}
					/>
				</div>
			</CrystScreen>
		);
	}

	if (!activeSession) {
		return (
			<CrystScreen>
				<div className="flex flex-1 items-center justify-center p-4">
					<EmptyState
						className="border-none bg-transparent py-0"
						description="Start a live session from the sessions screen."
						heading="No active session"
					/>
				</div>
			</CrystScreen>
		);
	}

	if (activeSession.type === "tournament") {
		return (
			<CrystScreen>
				<div className="flex flex-1 items-center justify-center p-4 text-center text-muted-foreground text-sm">
					Tournament sessions are not on this screen yet
				</div>
			</CrystScreen>
		);
	}

	return (
		<CrystScreen>
			<CashCockpit sessionId={activeSession.id} />
		</CrystScreen>
	);
}
