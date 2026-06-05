import { IconLogout } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { LinkedAccounts } from "@/shared/components/linked-accounts";
import { PageHeader } from "@/shared/components/page-header";
import { PageSection } from "@/shared/components/page-section";
import { ThemeSetting } from "@/shared/components/theme-setting";
import { Button } from "@/shared/components/ui/button";

export const Route = createFileRoute("/settings")({
	component: SettingsComponent,
});

function SettingsComponent() {
	const navigate = useNavigate();

	return (
		<div className="theme-v2 min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader
					actions={
						<Button
							onClick={() => {
								authClient.signOut({
									fetchOptions: {
										onSuccess: () => {
											navigate({ to: "/" });
										},
									},
								});
							}}
							variant="destructive"
						>
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
