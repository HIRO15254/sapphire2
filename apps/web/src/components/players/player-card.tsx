import { IconEdit, IconNote, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { ColorBadge } from "@/components/players/color-badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

function stripHtml(html: string): string {
	const doc = new DOMParser().parseFromString(html, "text/html");
	return doc.body.textContent ?? "";
}

interface PlayerCardProps {
	onDelete: (id: string) => void;
	onEdit: (player: PlayerCardProps["player"]) => void;
	onMemo: (player: PlayerCardProps["player"]) => void;
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

export function PlayerCard({
	player,
	onEdit,
	onDelete,
	onMemo,
}: PlayerCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const memoExcerpt = player.memo ? stripHtml(player.memo) : null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<span className="flex items-center gap-1.5">
						{player.name}
						{player.memo && (
							<IconNote className="shrink-0 text-muted-foreground" size={14} />
						)}
					</span>
				</CardTitle>
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
								aria-label="Edit memo"
								onClick={() => onMemo(player)}
								size="sm"
								variant="ghost"
							>
								<IconNote size={16} />
							</Button>
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
			<CardContent>
				{player.tags.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{player.tags.map((tag) => (
							<ColorBadge color={tag.color} key={tag.id}>
								{tag.name}
							</ColorBadge>
						))}
					</div>
				)}
				{memoExcerpt && (
					<p className="mt-2 line-clamp-2 text-muted-foreground text-sm">
						{memoExcerpt.length > 100
							? `${memoExcerpt.slice(0, 100)}...`
							: memoExcerpt}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
