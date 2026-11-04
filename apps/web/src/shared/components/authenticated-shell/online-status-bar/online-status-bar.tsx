import { IconRefresh, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { useOnlineStatusBar } from "./use-online-status-bar";

type DisplayState = "hidden" | "offline" | "syncing" | "back-online";

function getBarClassName(displayState: DisplayState): string {
	const base =
		"flex h-6 items-center justify-center gap-1.5 px-3 font-medium text-xs transition-colors duration-[var(--duration-slow)]";
	if (displayState === "offline") {
		return `${base} bg-warning-soft text-warning-text`;
	}
	if (displayState === "syncing") {
		return `${base} bg-primary-soft text-primary-text`;
	}
	return `${base} bg-success-soft text-success-text`;
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
