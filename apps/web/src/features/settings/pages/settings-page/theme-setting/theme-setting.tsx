import { SettingsSection } from "@/features/settings/pages/settings-page/settings-section";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import { useThemeSetting } from "./use-theme-setting";

export function ThemeSetting() {
	const { options, onValueChange, value } = useThemeSetting();

	return (
		<SettingsSection heading="Appearance">
			<ToggleGroup
				aria-label="Theme"
				onValueChange={onValueChange}
				role="radiogroup"
				type="single"
				value={value}
			>
				{options.map(({ value: optionValue, label, icon: Icon }) => (
					<ToggleGroupItem key={optionValue} value={optionValue}>
						<Icon aria-hidden />
						<span className="truncate">{label}</span>
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</SettingsSection>
	);
}
