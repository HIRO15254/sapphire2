import { IconRefresh, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { useIsMutating } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useOnlineStatus } from "@/hooks/use-online-status";

type DisplayState = "hidden" | "offline" | "syncing" | "back-online";

function getBarClassName(displayState: DisplayState): string {
	const base =
		"flex h-6 items-center justify-center gap-1.5 px-3 font-medium text-xs transition-all duration-300";
	if (displayState === "offline") {
		return `${base} bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950`;
	}
	if (displayState === "syncing") {
		return `${base} bg-blue-500 text-white`;
	}
	return `${base} bg-green-500 text-white`;
}

export function OnlineStatusBar() {
	const isOnline = useOnlineStatus();
	const isMutating = useIsMutating();
	const [displayState, setDisplayState] = useState<DisplayState>("hidden");
	const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const wasOfflineRef = useRef(false);

	useEffect(() => {
		if (!isOnline) {
			wasOfflineRef.current = true;
			if (fadeTimerRef.current) {
				clearTimeout(fadeTimerRef.current);
				fadeTimerRef.current = null;
			}
			setDisplayState("offline");
			return;
		}

		if (!wasOfflineRef.current) {
			setDisplayState("hidden");
			return;
		}

		if (isMutating > 0) {
			setDisplayState("syncing");
			return;
		}

		setDisplayState("back-online");
		fadeTimerRef.current = setTimeout(() => {
			setDisplayState("hidden");
			wasOfflineRef.current = false;
		}, 2000);

		return () => {
			if (fadeTimerRef.current) {
				clearTimeout(fadeTimerRef.current);
			}
		};
	}, [isOnline, isMutating]);

	if (displayState === "hidden") {
		return null;
	}

	return (
		<div className={getBarClassName(displayState)}>
			{displayState === "offline" && (
				<>
					<IconWifiOff size={14} />
					<span>Offline — changes will sync when back online</span>
				</>
			)}
			{displayState === "syncing" && (
				<>
					<IconRefresh className="animate-spin" size={14} />
					<span>Syncing...</span>
				</>
			)}
			{displayState === "back-online" && (
				<>
					<IconWifi size={14} />
					<span>Back online</span>
				</>
			)}
		</div>
	);
}
