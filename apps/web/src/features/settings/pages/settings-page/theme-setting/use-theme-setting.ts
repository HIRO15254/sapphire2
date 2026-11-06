import { IconDeviceMobile, IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";

export const THEME_OPTIONS = [
	{ icon: IconDeviceMobile, label: "System", value: "system" },
	{ icon: IconSun, label: "Light", value: "light" },
	{ icon: IconMoon, label: "Dark", value: "dark" },
] as const;

export function useThemeSetting() {
	const { setTheme, theme } = useTheme();

	return {
		onValueChange: (value: string) => {
			if (value) {
				setTheme(value);
			}
		},
		options: THEME_OPTIONS,
		value: theme ?? "system",
	};
}
