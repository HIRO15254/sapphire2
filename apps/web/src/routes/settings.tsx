import { createFileRoute } from "@tanstack/react-router";
import { LinkedAccounts } from "@/components/linked-accounts";
import { SessionTagManager } from "@/components/management/session-tag-manager";
import { TransactionTypeManager } from "@/components/stores/transaction-type-manager";

export const Route = createFileRoute("/settings")({
	component: SettingsComponent,
});

function SettingsComponent() {
	return (
		<div className="container mx-auto max-w-3xl px-4 py-2">
			<h1 className="font-bold text-2xl">Settings</h1>

			<section className="mt-6">
				<h2 className="mb-3 font-semibold text-lg">Linked Accounts</h2>
				<LinkedAccounts />
			</section>

			<section className="mt-6">
				<h2 className="mb-3 font-semibold text-lg">Data Management</h2>
				<div className="flex flex-col gap-4">
					<div>
						<h3 className="mb-2 font-medium text-sm">Transaction Types</h3>
						<p className="mb-3 text-muted-foreground text-xs">
							Manage transaction type labels used for currency transactions.
							Types in use by existing transactions cannot be deleted.
						</p>
						<TransactionTypeManager />
					</div>
				</div>
			</section>

			<section className="mt-8">
				<h2 className="mb-4 font-semibold text-lg">Session Tags</h2>
				<SessionTagManager />
			</section>
		</div>
	);
}
