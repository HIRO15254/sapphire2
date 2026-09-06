import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";

export function useLiveSessionPage() {
	const { activeSession, isError, isLoading, onRetry } = useActiveSession();

	return { activeSession, isError, isLoading, onRetry };
}
