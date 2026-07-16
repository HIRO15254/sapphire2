import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";
import { useMediaQuery } from "@/shared/hooks/use-media-query";

const DESKTOP_BREAKPOINT = "(min-width: 768px)";

export function useAuthenticatedShell() {
	const isDesktop = useMediaQuery(DESKTOP_BREAKPOINT);
	// Expose the active session id so the shell can key SessionFormProvider's
	// state by it — clearing the Record Stack form (and its chipPurchaseCounts)
	// whenever the live session changes (SA2-171).
	const { activeSession } = useActiveSession();
	return { isDesktop, activeSessionId: activeSession?.id ?? null };
}
