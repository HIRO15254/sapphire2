import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";

export function useActiveSessionPage() {
	const { activeSession, isError, isLoading, onRetry } = useActiveSession();

	return { activeSession, isError, isLoading, onRetry };
}
