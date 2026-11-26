import { SectionLoadError } from "@/features/settings/pages/settings-page/section-load-error";
import { SettingsSection } from "@/features/settings/pages/settings-page/settings-section";
import { Field } from "@/shared/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Spinner } from "@/shared/components/ui/spinner";
import { useWalletSettings } from "./use-wallet-settings";

function SettingSelect({
	disabled,
	id,
	label,
	onValueChange,
	options,
	value,
}: {
	disabled: boolean;
	id: string;
	label: string;
	onValueChange: (value: string) => void;
	options: { label: string; value: string }[];
	value: string;
}) {
	return (
		<Field htmlFor={id} label={label}>
			<Select disabled={disabled} onValueChange={onValueChange} value={value}>
				<SelectTrigger id={id}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

export function WalletSettings() {
	const {
		baseOptions,
		baseValue,
		isError,
		isLoading,
		isPending,
		isRetrying,
		onBaseChange,
		onRetry,
		onTimeZoneChange,
		timeZoneOptions,
		timeZoneValue,
	} = useWalletSettings();

	function renderBody() {
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Query state changes after the initial render.
		if (isLoading) {
			return (
				<div className="text-muted-foreground flex justify-center py-3">
					<Spinner />
				</div>
			);
		}
		if (isError) {
			return (
				<SectionLoadError
					isRetrying={isRetrying}
					message="Couldn't load your asset settings."
					onRetry={onRetry}
				/>
			);
		}
		return (
			<div className="flex flex-col gap-3.5">
				<SettingSelect
					disabled={isPending}
					id="setting-base-currency"
					label="Base currency"
					onValueChange={onBaseChange}
					options={baseOptions}
					value={baseValue}
				/>
				<SettingSelect
					disabled={isPending}
					id="setting-time-zone"
					label="Time zone"
					onValueChange={onTimeZoneChange}
					options={timeZoneOptions}
					value={timeZoneValue}
				/>
			</div>
		);
	}

	return <SettingsSection heading="Assets">{renderBody()}</SettingsSection>;
}
