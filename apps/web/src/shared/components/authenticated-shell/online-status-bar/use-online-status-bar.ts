import { useIsMutating } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "@/shared/hooks/use-online-status";

type DisplayState = "hidden" | "offline" | "syncing" | "back-online";

interface UseOnlineStatusBarResult {
	displayState: DisplayState;
}

export function useOnlineStatusBar(): UseOnlineStatusBarResult {
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

	return { displayState };
}
