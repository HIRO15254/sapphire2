import { IconLogout } from "@tabler/icons-react";
import { LinkedAccounts } from "@/shared/components/linked-accounts";
import { PageHeader } from "@/shared/components/page-header";
import { PageSection } from "@/shared/components/page-section";
import { ThemeSetting } from "@/shared/components/theme-setting";
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
							Sign Out
						</Button>
					}
					heading="Settings"
				/>

				<div className="space-y-6">
					<PageSection heading="Appearance">
						<ThemeSetting />
					</PageSection>

					<PageSection heading="Linked Accounts">
						<LinkedAccounts />
					</PageSection>
				</div>
			</div>
		</div>
	);
}
