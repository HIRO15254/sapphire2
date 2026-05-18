import type { ReactNode } from "react";
import { useCurrentDevice } from "@/shared/hooks/use-current-device";

interface ResponsiveScreenProps {
	/** Subtree rendered on desktop viewports (>= 768px). */
	desktop: ReactNode;
	/** Subtree rendered on mobile viewports (< 768px). */
	mobile: ReactNode;
}

/**
 * Picks an entirely separate PC or mobile subtree for the current device.
 * Only the matched slot is mounted, so the unused platform's tree never runs.
 */
export function ResponsiveScreen({ desktop, mobile }: ResponsiveScreenProps) {
	const device = useCurrentDevice();
	return <>{device === "desktop" ? desktop : mobile}</>;
}
