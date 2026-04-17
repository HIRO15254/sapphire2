import { useMediaQuery } from "@/shared/hooks/use-media-query";

export type Device = "mobile" | "desktop";

export const DESKTOP_BREAKPOINT = "(min-width: 768px)";

export function useCurrentDevice(): Device {
	const isDesktop = useMediaQuery(DESKTOP_BREAKPOINT);
	return isDesktop ? "desktop" : "mobile";
}
