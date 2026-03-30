import {
	IconChevronDown,
	IconChevronUp,
	IconEdit,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { RingGameTab } from "@/components/stores/ring-game-tab";
import { TournamentTab } from "@/components/stores/tournament-tab";
import { Button } from "@/components/ui/button";

interface StoreCardProps {
	onDelete: (id: string) => void;
	onEdit: (store: { id: string; memo?: string | null; name: string }) => void;
	store: {
		id: string;
		memo?: string | null;
		name: string;
	};
}

export function StoreCard({ store, onEdit, onDelete }: StoreCardProps) {
	const [expanded, setExpanded] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	return (
		<div className="rounded-lg border bg-card">
			<div className="flex items-start gap-2 p-3">
				<div className="min-w-0 flex-1">
					<span className="font-medium text-sm">{store.name}</span>
					{store.memo && (
						<p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
							{store.memo}
						</p>
					)}
				</div>

				<Button
					aria-label={expanded ? "Collapse details" : "Expand details"}
					className="shrink-0 text-muted-foreground"
					onClick={() => {
						setExpanded((prev) => !prev);
						setConfirmingDelete(false);
					}}
					size="icon-xs"
					variant="ghost"
				>
					{expanded ? (
						<IconChevronUp size={16} />
					) : (
						<IconChevronDown size={16} />
					)}
				</Button>
			</div>

			<div
				className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
			>
				<div className="overflow-hidden">
					<div className="border-t px-3 py-2">
						<div className="space-y-3">
							<RingGameTab storeId={store.id} />
							<TournamentTab storeId={store.id} />
						</div>

						{confirmingDelete ? (
							<div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
								<span className="text-destructive text-xs">
									Delete this store?
								</span>
								<Button
									aria-label="Confirm delete"
									className="text-destructive hover:text-destructive"
									onClick={() => {
										onDelete(store.id);
										setConfirmingDelete(false);
										setExpanded(false);
									}}
									size="xs"
									variant="ghost"
								>
									<IconTrash size={14} />
									Delete
								</Button>
								<Button
									aria-label="Cancel delete"
									onClick={() => setConfirmingDelete(false)}
									size="xs"
									variant="ghost"
								>
									<IconX size={14} />
									Cancel
								</Button>
							</div>
						) : (
							<div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
								<Button onClick={() => onEdit(store)} size="xs" variant="ghost">
									<IconEdit size={14} />
									Edit
								</Button>
								<Button
									className="text-destructive hover:text-destructive"
									onClick={() => setConfirmingDelete(true)}
									size="xs"
									variant="ghost"
								>
									<IconTrash size={14} />
									Delete
								</Button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
