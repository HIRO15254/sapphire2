import { useTheme } from "next-themes";
import { useMediaQuery } from "@/shared/hooks/use-media-query";

export function useToaster() {
	const { theme = "system" } = useTheme();
	const isDesktop = useMediaQuery("(min-width: 768px)");
	return { theme, isDesktop };
}
