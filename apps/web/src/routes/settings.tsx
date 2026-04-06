import { IconLogout } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LinkedAccounts } from "@/shared/components/linked-accounts";
import { SessionTagManager } from "@/sessions/components/session-tag-manager";
import { PageHeader } from "@/shared/components/page-header";
import { PageSection } from "@/shared/components/page-section";
import { TransactionTypeManager } from "@/currencies/components/transaction-type-manager";
import { Button } from "@/shared/components/ui/button";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/settings")({
	component: SettingsComponent,
});

function SettingsComponent() {
	const navigate = useNavigate();

	return (
		<div className="container mx-auto max-w-3xl px-4 py-2">
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
				description="Manage login methods and shared labels used across the app."
				heading="Settings"
			/>

			<div className="space-y-6">
				<PageSection
					description="Connect social providers or add an email and password login."
					heading="Linked Accounts"
				>
					<LinkedAccounts />
				</PageSection>

				<PageSection
					description="Manage transaction type labels used for currency transactions. Types in use by existing transactions cannot be deleted."
					heading="Transaction Types"
				>
					<TransactionTypeManager />
				</PageSection>

				<PageSection
					description="Manage reusable tags for session records and filters."
					heading="Session Tags"
				>
					<SessionTagManager />
				</PageSection>
			</div>
		</div>
	);
}
