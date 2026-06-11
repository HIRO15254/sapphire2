import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";

export function useActiveSessionEventsPage() {
	const { activeSession, isLoading } = useActiveSession();

	return { activeSession, isLoading };
}
