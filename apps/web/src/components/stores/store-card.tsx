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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

				<div className="flex shrink-0 items-center gap-1">
					{confirmingDelete ? (
						<>
							<span className="text-destructive text-xs">Delete?</span>
							<Button
								aria-label="Confirm delete"
								className="text-destructive hover:text-destructive"
								onClick={() => {
									onDelete(store.id);
									setConfirmingDelete(false);
								}}
								size="icon-xs"
								variant="ghost"
							>
								<IconTrash size={16} />
							</Button>
							<Button
								aria-label="Cancel delete"
								onClick={() => setConfirmingDelete(false)}
								size="icon-xs"
								variant="ghost"
							>
								<IconX size={16} />
							</Button>
						</>
					) : (
						<>
							<Button
								aria-label="Edit store"
								onClick={() => onEdit(store)}
								size="icon-xs"
								variant="ghost"
							>
								<IconEdit size={16} />
							</Button>
							<Button
								aria-label="Delete store"
								onClick={() => setConfirmingDelete(true)}
								size="icon-xs"
								variant="ghost"
							>
								<IconTrash size={16} />
							</Button>
						</>
					)}
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
			</div>

			<div
				className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
			>
				<div className="overflow-hidden">
					<div className="border-t px-3 py-2">
						<Tabs defaultValue="ring-games">
							<TabsList>
								<TabsTrigger value="ring-games">Cash Games</TabsTrigger>
								<TabsTrigger value="tournaments">Tournaments</TabsTrigger>
							</TabsList>
							<TabsContent value="ring-games">
								<RingGameTab storeId={store.id} />
							</TabsContent>
							<TabsContent value="tournaments">
								<TournamentTab storeId={store.id} />
							</TabsContent>
						</Tabs>
					</div>
				</div>
			</div>
		</div>
	);
}
