import { IconDeviceMobile, IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";

export const THEME_OPTIONS = [
	{ value: "system", label: "System", icon: IconDeviceMobile },
	{ value: "light", label: "Light", icon: IconSun },
	{ value: "dark", label: "Dark", icon: IconMoon },
] as const;

export function useThemeSetting() {
	const { setTheme, theme } = useTheme();

	return {
		options: THEME_OPTIONS,
		onValueChange: (value: string) => {
			if (value) {
				setTheme(value);
			}
		},
		value: theme ?? "system",
	};
}
