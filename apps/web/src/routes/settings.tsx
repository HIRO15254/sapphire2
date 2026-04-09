import { useState } from "react";
import { IconLogout } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TransactionTypeManager } from "@/currencies/components/transaction-type-manager";
import { authClient } from "@/lib/auth-client";
import {
	fetchLatestReleaseNotes,
	latestReleaseNotesQueryKey,
} from "@/lib/release-notes";
import { SessionTagManager } from "@/sessions/components/session-tag-manager";
import { LinkedAccounts } from "@/shared/components/linked-accounts";
import { PageHeader } from "@/shared/components/page-header";
import { PageSection } from "@/shared/components/page-section";
import { ReleaseNotesDialog } from "@/shared/components/release-notes-dialog";
import { Button } from "@/shared/components/ui/button";

export const Route = createFileRoute("/settings")({
	component: SettingsComponent,
});

function SettingsComponent() {
	const navigate = useNavigate();
	const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
	const latestReleaseNotesQuery = useQuery({
		queryKey: latestReleaseNotesQueryKey,
		queryFn: fetchLatestReleaseNotes,
		retry: false,
	});

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

				<PageSection
					description="Review the latest user-facing updates from inside the app."
					heading="What's New"
				>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="text-muted-foreground text-sm">
							{latestReleaseNotesQuery.data ? (
								<span>Latest version: v{latestReleaseNotesQuery.data.version}</span>
							) : latestReleaseNotesQuery.isError ? (
								<span>Release notes are temporarily unavailable.</span>
							) : (
								<span>Loading release notes...</span>
							)}
						</div>
						<Button
							disabled={!latestReleaseNotesQuery.data}
							onClick={() => setIsReleaseNotesOpen(true)}
							variant="outline"
						>
							Open latest notes
						</Button>
					</div>
				</PageSection>
			</div>

			{latestReleaseNotesQuery.data ? (
				<ReleaseNotesDialog
					description="Review the latest user-facing updates at any time."
					notes={latestReleaseNotesQuery.data}
					onOpenChange={setIsReleaseNotesOpen}
					open={isReleaseNotesOpen}
				/>
			) : null}
		</div>
	);
}
