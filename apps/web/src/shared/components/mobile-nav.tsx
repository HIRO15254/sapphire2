import { IconBolt, IconPlayerPlay, IconPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CreateSessionDialog } from "@/live-sessions/components/create-session-dialog";
import { useActiveSession } from "@/live-sessions/hooks/use-active-session";
import { useStackSheet } from "@/live-sessions/hooks/use-stack-sheet";
import { createSessionEventMutationOptions } from "@/live-sessions/utils/optimistic-session-event";
import {
	getMobileNavigationItems,
	isActiveItem,
	MobileNavItem,
	type NavigationCenterAction,
	NavigationCenterButton,
	type NavigationItem,
	RESOURCE_ITEMS,
} from "@/shared/components/app-navigation";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover";
import { trpcClient } from "@/utils/trpc";

function MobileNavPopoverItem({
	active,
	item,
	children,
}: {
	active: boolean;
	item: NavigationItem;
	children: readonly NavigationItem[];
}) {
	const [open, setOpen] = useState(false);

	return (
		<li className="flex-1">
			<Popover onOpenChange={setOpen} open={open}>
				<PopoverTrigger asChild>
					<button
						className={cn(
							"flex w-full flex-col items-center gap-0.5 py-1.5 text-xs transition-colors",
							active
								? "font-semibold text-sidebar-primary"
								: "text-sidebar-foreground/60"
						)}
						type="button"
					>
						<item.icon size={22} stroke={active ? 2.5 : 1.5} />
						<span>{item.label}</span>
					</button>
				</PopoverTrigger>
				<PopoverContent className="w-48 p-1" side="top" sideOffset={12}>
					<ul className="flex flex-col gap-0.5">
						{children.map((child) => (
							<li key={child.to}>
								<Link
									className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent"
									onClick={() => setOpen(false)}
									to={child.to}
								>
									<child.icon size={18} stroke={1.5} />
									<span>{child.label}</span>
								</Link>
							</li>
						))}
					</ul>
				</PopoverContent>
			</Popover>
		</li>
	);
}

export function MobileNav() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const { activeSession, hasActive } = useActiveSession();
	const stackSheet = useStackSheet();
	const queryClient = useQueryClient();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const isPaused = activeSession?.status === "paused";
	const { leftItems, rightItems } = getMobileNavigationItems(
		hasActive && !isPaused
	);

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

	let centerAction: NavigationCenterAction;
	if (hasActive && activeSession?.status === "paused") {
		centerAction = {
			icon: IconPlayerPlay,
			label: "Resume",
			onClick: () => resumeMutation.mutate(),
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
			icon: IconPlus,
			label: "New",
			onClick: () => setIsCreateOpen(true),
			tone: "accent" as const,
		};
	}

	return (
		<>
			<nav className="fixed inset-x-0 bottom-0 z-40 border-sidebar-border border-t bg-sidebar md:hidden">
				<ul className="grid h-16 grid-cols-5 items-center">
					{leftItems.map((item) => (
						<MobileNavItem
							active={isActiveItem(pathname, item)}
							item={item}
							key={item.to}
						/>
					))}

					<li className="flex justify-center self-stretch">
						<NavigationCenterButton action={centerAction} />
					</li>

					{rightItems.map((item) =>
						item.matchPaths ? (
							<MobileNavPopoverItem
								active={isActiveItem(pathname, item)}
								item={item}
								key={item.to}
							>
								{RESOURCE_ITEMS}
							</MobileNavPopoverItem>
						) : (
							<MobileNavItem
								active={isActiveItem(pathname, item)}
								item={item}
								key={item.to}
							/>
						)
					)}
				</ul>
			</nav>

			{!hasActive && (
				<CreateSessionDialog
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
				/>
			)}
		</>
	);
}
