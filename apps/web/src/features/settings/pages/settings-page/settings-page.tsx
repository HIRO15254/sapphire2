import { IconLogout } from "@tabler/icons-react";
import { LinkedAccounts } from "@/features/settings/pages/settings-page/linked-accounts";
import { ThemeSetting } from "@/features/settings/pages/settings-page/theme-setting";
import { PageHeader } from "@/shared/components/page-header";
import { PageSection } from "@/shared/components/page-section";
import { Button } from "@/shared/components/ui/button";
import { useSettingsPage } from "./use-settings-page";

export function SettingsPage() {
	const { onSignOut } = useSettingsPage();

	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader
					actions={
						<Button onClick={onSignOut} variant="destructive">
							<IconLogout size={16} />
							Sign out
						</Button>
					}
					heading="Settings"
				/>

				<div className="space-y-6">
					<PageSection heading="Appearance">
						<ThemeSetting />
					</PageSection>

					<PageSection heading="Linked accounts">
						<LinkedAccounts />
					</PageSection>
				</div>
			</div>
		</div>
	);
}
