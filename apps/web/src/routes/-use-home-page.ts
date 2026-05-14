import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";

export function useHomePage() {
	const navigate = useNavigate();
	const { activeSession, isLoading } = useActiveSession();
	const navigated = useRef(false);

	useEffect(() => {
		if (isLoading || navigated.current) {
			return;
		}
		navigated.current = true;
		if (activeSession) {
			navigate({ to: "/active-session" });
		} else {
			navigate({ to: "/dashboard" });
		}
	}, [isLoading, activeSession, navigate]);
}
