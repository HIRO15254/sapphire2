import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export function useHomePage() {
	const { data: authSession, isPending: isAuthPending } =
		authClient.useSession();
	const navigate = useNavigate();
	const isSignedIn = Boolean(authSession);

	const cashActiveQuery = useQuery({
		...trpc.liveCashGameSession.list.queryOptions({
			status: "active",
			limit: 1,
		}),
		enabled: isSignedIn,
	});
	const tournamentActiveQuery = useQuery({
		...trpc.liveTournamentSession.list.queryOptions({
			status: "active",
			limit: 1,
		}),
		enabled: isSignedIn,
	});

	const hasActiveSession = Boolean(
		cashActiveQuery.data?.items?.[0] || tournamentActiveQuery.data?.items?.[0]
	);
	const isSessionLoading =
		isSignedIn &&
		(cashActiveQuery.isLoading || tournamentActiveQuery.isLoading);
	const isLoading = isAuthPending || isSessionLoading;

	useEffect(() => {
		if (isLoading) {
			return;
		}
		if (!isSignedIn) {
			navigate({ to: "/login" });
			return;
		}
		if (hasActiveSession) {
			navigate({ to: "/active-session" });
		} else {
			navigate({ to: "/dashboard" });
		}
	}, [isLoading, isSignedIn, hasActiveSession, navigate]);

	return { isLoading };
}
