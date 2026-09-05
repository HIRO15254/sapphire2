import { IconBolt, IconPlayerPlayFilled } from "@tabler/icons-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";
import {
	getMobileNavigationItems,
	type NavigationCenterAction,
} from "@/shared/components/app-navigation";

const ACTIVE_SESSION_PATH = "/active-session";

interface UseMobileNavResult {
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
	const { hasActive } = useActiveSession();
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const { leftItems, rightItems } = getMobileNavigationItems();

	const centerAction: NavigationCenterAction = hasActive
		? {
				icon: IconBolt,
				label: "Live",
				onClick: () => {
					navigate({ to: ACTIVE_SESSION_PATH });
				},
				tone: "live" as const,
			}
		: {
				icon: IconPlayerPlayFilled,
				label: "Start",
				onClick: () => setIsCreateOpen(true),
				tone: "accent" as const,
			};

	return {
		centerAction,
		hasActive,
		isCreateOpen,
		leftItems,
		onCreateOpenChange: setIsCreateOpen,
		pathname,
		rightItems,
	};
}
