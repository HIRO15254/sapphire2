import {
	IconBolt,
	IconPlayerPlay,
	IconPlayerPlayFilled,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";
import { useStackSheet } from "@/features/live-sessions/hooks/use-stack-sheet";
import { createSessionEventMutationOptions } from "@/features/live-sessions/utils/optimistic-session-event";
import {
	getMobileNavigationItems,
	type NavigationCenterAction,
} from "@/shared/components/app-navigation";
import { trpcClient } from "@/utils/trpc";

const ACTIVE_SESSION_PATH = "/active-session";

interface UseMobileNavResult {
	activeSession: ReturnType<typeof useActiveSession>["activeSession"];
	centerAction: NavigationCenterAction;
	hasActive: boolean;
	isCreateOpen: boolean;
	leftItems: ReturnType<typeof getMobileNavigationItems>["leftItems"];
	onCreateOpenChange: (open: boolean) => void;
	pathname: string;
	rightItems: ReturnType<typeof getMobileNavigationItems>["rightItems"];
}

export function useMobileNav(): UseMobileNavResult {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const navigate = useNavigate();
	const { activeSession, hasActive } = useActiveSession();
	const stackSheet = useStackSheet();
	const queryClient = useQueryClient();
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const { leftItems, rightItems } = getMobileNavigationItems();

	const optimisticOptions = activeSession
		? createSessionEventMutationOptions({
				queryClient,
				sessionId: activeSession.id,
				sessionType: activeSession.type,
				eventType: "session_resume",
				getPayload: () => ({}),
				changesStatus: true,
			})
		: {};

	const resumeMutation = useMutation({
		mutationFn: async () => {
			if (!activeSession) {
				return;
			}
			const sessionIdKey =
				activeSession.type === "cash_game"
					? "liveCashGameSessionId"
					: "liveTournamentSessionId";
			await trpcClient.sessionEvent.create.mutate({
				[sessionIdKey]: activeSession.id,
				eventType: "session_resume",
				payload: {},
			});
		},
		...optimisticOptions,
	});

	const isOnActiveSessionPage =
		pathname === ACTIVE_SESSION_PATH ||
		pathname.startsWith(`${ACTIVE_SESSION_PATH}/`);

	let centerAction: NavigationCenterAction;
	if (hasActive && activeSession?.status === "paused") {
		centerAction = {
			icon: IconPlayerPlay,
			label: "Resume",
			onClick: () => {
				resumeMutation.mutate();
				navigate({ to: ACTIVE_SESSION_PATH });
			},
			tone: "live" as const,
		};
	} else if (hasActive && !isOnActiveSessionPage) {
		centerAction = {
			icon: IconBolt,
			label: "Live",
			onClick: () => {
				navigate({ to: ACTIVE_SESSION_PATH });
			},
			tone: "live" as const,
		};
	} else if (hasActive) {
		centerAction = {
			icon: IconBolt,
			label: "Stack",
			onClick: () => stackSheet.open(),
			tone: "live" as const,
		};
	} else {
		centerAction = {
			icon: IconPlayerPlayFilled,
			label: "Start",
			onClick: () => setIsCreateOpen(true),
			tone: "accent" as const,
		};
	}

	return {
		activeSession,
		centerAction,
		hasActive,
		isCreateOpen,
		leftItems,
		onCreateOpenChange: setIsCreateOpen,
		pathname,
		rightItems,
	};
}
