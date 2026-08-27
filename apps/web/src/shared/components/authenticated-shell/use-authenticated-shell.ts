import { useRouterState } from "@tanstack/react-router";
import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";
import { useMediaQuery } from "@/shared/hooks/use-media-query";

const DESKTOP_BREAKPOINT = "(min-width: 768px)";
const IMMERSIVE_PATH = "/active-session";

export function isImmersivePath(pathname: string): boolean {
	return (
		pathname === IMMERSIVE_PATH || pathname.startsWith(`${IMMERSIVE_PATH}/`)
	);
}

export function useAuthenticatedShell() {
	const isDesktop = useMediaQuery(DESKTOP_BREAKPOINT);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { activeSession } = useActiveSession();
	return {
		activeSessionId: activeSession?.id ?? null,
		isDesktop,
		isImmersive: isImmersivePath(pathname),
	};
}
