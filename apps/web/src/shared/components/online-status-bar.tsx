import { IconRefresh, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { useOnlineStatusBar } from "@/shared/hooks/use-online-status-bar";

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
	const { displayState } = useOnlineStatusBar();

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
