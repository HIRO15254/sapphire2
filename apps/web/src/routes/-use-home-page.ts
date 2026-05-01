import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";

export function useHomePage() {
	const navigate = useNavigate();
	const { hasActive, isLoading } = useActiveSession();

	useEffect(() => {
		if (isLoading) {
			return;
		}
		if (hasActive) {
			navigate({ to: "/active-session" });
		} else {
			navigate({ to: "/dashboard" });
		}
	}, [isLoading, hasActive, navigate]);

	return { isLoading };
}
