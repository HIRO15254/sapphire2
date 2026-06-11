import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";

export function useActiveSessionPage() {
	const { activeSession, isLoading } = useActiveSession();

	return { activeSession, isLoading };
}
