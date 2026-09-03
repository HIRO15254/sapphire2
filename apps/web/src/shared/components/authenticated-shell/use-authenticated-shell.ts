import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";
import { useMediaQuery } from "@/shared/hooks/use-media-query";

const DESKTOP_BREAKPOINT = "(min-width: 768px)";

export function useAuthenticatedShell() {
	const isDesktop = useMediaQuery(DESKTOP_BREAKPOINT);
	const { activeSession } = useActiveSession();
	return { isDesktop, activeSessionId: activeSession?.id ?? null };
}
