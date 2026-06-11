import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";

export const THEME_OPTIONS = [
	{ value: "light", label: "Light", icon: IconSun },
	{ value: "dark", label: "Dark", icon: IconMoon },
	{ value: "system", label: "System", icon: IconDeviceDesktop },
] as const;

export function useThemeSetting() {
	const { setTheme, theme } = useTheme();

	return {
		options: THEME_OPTIONS,
		onValueChange: setTheme,
		value: theme ?? "",
	};
}
