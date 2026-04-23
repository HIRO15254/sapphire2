import { IconLogout } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { LinkedAccounts } from "@/shared/components/linked-accounts";
import { PageHeader } from "@/shared/components/page-header";
import { PageSection } from "@/shared/components/page-section";
import { Button } from "@/shared/components/ui/button";

export const Route = createFileRoute("/settings")({
	component: SettingsComponent,
});

function SettingsComponent() {
	const navigate = useNavigate();

	return (
		<div className="p-4 md:p-6">
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
				description="Manage login methods and account preferences."
				heading="Settings"
			/>

			<PageSection
				description="Connect social providers or add an email and password login."
				heading="Linked Accounts"
			>
				<LinkedAccounts />
			</PageSection>
		</div>
	);
}
