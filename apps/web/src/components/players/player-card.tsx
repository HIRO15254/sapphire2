import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface PlayerCardProps {
	onDelete: (id: string) => void;
	onEdit: (player: PlayerCardProps["player"]) => void;
	player: {
		createdAt: string;
		id: string;
		memo: string | null;
		name: string;
		tags: Array<{ id: string; name: string; color: string }>;
		updatedAt: string;
		userId: string;
	};
}

function formatDate(date: string): string {
	const d = new Date(date);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}/${m}/${day}`;
}

export function PlayerCard({ player, onEdit, onDelete }: PlayerCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{player.name}</CardTitle>
				<CardDescription>Added {formatDate(player.createdAt)}</CardDescription>
				<CardAction>
					{confirmingDelete ? (
						<div className="flex items-center gap-1">
							<span className="text-destructive text-xs">Delete?</span>
							<Button
								aria-label="Confirm delete"
								className="text-destructive hover:text-destructive"
								onClick={() => {
									onDelete(player.id);
									setConfirmingDelete(false);
								}}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={16} />
							</Button>
							<Button
								aria-label="Cancel delete"
								onClick={() => setConfirmingDelete(false)}
								size="sm"
								variant="ghost"
							>
								<IconX size={16} />
							</Button>
						</div>
					) : (
						<div className="flex gap-1">
							<Button
								aria-label="Edit player"
								onClick={() => onEdit(player)}
								size="sm"
								variant="ghost"
							>
								<IconEdit size={16} />
							</Button>
							<Button
								aria-label="Delete player"
								onClick={() => setConfirmingDelete(true)}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={16} />
							</Button>
						</div>
					)}
				</CardAction>
			</CardHeader>
			<CardContent />
		</Card>
	);
}
