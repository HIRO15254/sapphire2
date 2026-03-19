import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
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
	const navigate = useNavigate();
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const handleCardClick = () => {
		navigate({ to: "/stores/$storeId", params: { storeId: store.id } });
	};

	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation();
		onEdit(store);
	};

	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setConfirmingDelete(true);
	};

	const handleDeleteConfirm = (e: React.MouseEvent) => {
		e.stopPropagation();
		onDelete(store.id);
		setConfirmingDelete(false);
	};

	const handleDeleteCancel = (e: React.MouseEvent) => {
		e.stopPropagation();
		setConfirmingDelete(false);
	};

	return (
		<Card
			className="cursor-pointer transition-colors hover:bg-accent"
			onClick={handleCardClick}
		>
			<CardHeader>
				<CardTitle>{store.name}</CardTitle>
				{store.memo && (
					<CardDescription className="line-clamp-2">
						{store.memo}
					</CardDescription>
				)}
				<CardAction>
					{confirmingDelete ? (
						<div className="flex items-center gap-1">
							<span className="text-destructive text-xs">Delete?</span>
							<Button
								aria-label="Confirm delete"
								className="text-destructive hover:text-destructive"
								onClick={handleDeleteConfirm}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={16} />
							</Button>
							<Button
								aria-label="Cancel delete"
								onClick={handleDeleteCancel}
								size="sm"
								variant="ghost"
							>
								<IconX size={16} />
							</Button>
						</div>
					) : (
						<div className="flex gap-1">
							<Button
								aria-label="Edit store"
								onClick={handleEdit}
								size="sm"
								variant="ghost"
							>
								<IconEdit size={16} />
							</Button>
							<Button
								aria-label="Delete store"
								onClick={handleDeleteClick}
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
