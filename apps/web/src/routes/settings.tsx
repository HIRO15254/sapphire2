import { IconCheck, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LinkedAccounts } from "@/components/linked-accounts";
import { TransactionTypeManager } from "@/components/stores/transaction-type-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/settings")({
	component: SettingsComponent,
});

function SessionTagManager() {
	const queryClient = useQueryClient();
	const tagsKey = trpc.sessionTag.list.queryOptions().queryKey;

	const tagsQuery = useQuery(trpc.sessionTag.list.queryOptions());
	const tags = tagsQuery.data ?? [];

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingName, setEditingName] = useState("");
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);

	const updateMutation = useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			trpcClient.sessionTag.update.mutate({ id, name }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: tagsKey });
		},
		onSuccess: () => {
			setEditingId(null);
			setEditingName("");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.sessionTag.delete.mutate({ id }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: tagsKey });
		},
		onSuccess: () => {
			setConfirmingDeleteId(null);
		},
	});

	const startEditing = (tag: { id: string; name: string }) => {
		setEditingId(tag.id);
		setEditingName(tag.name);
		setConfirmingDeleteId(null);
	};

	const cancelEditing = () => {
		setEditingId(null);
		setEditingName("");
	};

	const saveEditing = (id: string) => {
		if (!editingName.trim()) {
			return;
		}
		updateMutation.mutate({ id, name: editingName.trim() });
	};

	if (tags.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No session tags yet. Create tags when recording sessions.
			</p>
		);
	}

	return (
		<ul className="flex flex-col gap-2">
			{tags.map((tag) => (
				<li
					className="flex items-center gap-2 rounded-md border px-3 py-2"
					key={tag.id}
				>
					{editingId === tag.id ? (
						<>
							<Input
								autoFocus
								className="h-7 flex-1 text-sm"
								onChange={(e) => setEditingName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										saveEditing(tag.id);
									} else if (e.key === "Escape") {
										cancelEditing();
									}
								}}
								value={editingName}
							/>
							<Button
								aria-label="Save tag name"
								disabled={!editingName.trim() || updateMutation.isPending}
								onClick={() => saveEditing(tag.id)}
								size="sm"
								variant="ghost"
							>
								<IconCheck size={14} />
							</Button>
							<Button
								aria-label="Cancel editing"
								onClick={cancelEditing}
								size="sm"
								variant="ghost"
							>
								<IconX size={14} />
							</Button>
						</>
					) : (
						<>
							<span className="flex-1 text-sm">{tag.name}</span>
							{confirmingDeleteId === tag.id ? (
								<>
									<span className="text-destructive text-xs">Delete?</span>
									<Button
										aria-label="Confirm delete tag"
										className="text-destructive hover:text-destructive"
										disabled={deleteMutation.isPending}
										onClick={() => deleteMutation.mutate(tag.id)}
										size="sm"
										variant="ghost"
									>
										<IconTrash size={14} />
									</Button>
									<Button
										aria-label="Cancel delete"
										onClick={() => setConfirmingDeleteId(null)}
										size="sm"
										variant="ghost"
									>
										<IconX size={14} />
									</Button>
								</>
							) : (
								<>
									<Button
										aria-label="Edit tag"
										onClick={() => startEditing(tag)}
										size="sm"
										variant="ghost"
									>
										<IconPencil size={14} />
									</Button>
									<Button
										aria-label="Delete tag"
										onClick={() => setConfirmingDeleteId(tag.id)}
										size="sm"
										variant="ghost"
									>
										<IconTrash size={14} />
									</Button>
								</>
							)}
						</>
					)}
				</li>
			))}
		</ul>
	);
}

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
