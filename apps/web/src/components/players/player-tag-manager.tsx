import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ColorBadge } from "@/components/players/color-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { TAG_COLOR_NAMES, type TagColor } from "@/constants/player-tag-colors";
import { trpc, trpcClient } from "@/utils/trpc";

interface TagFormValues {
	color: TagColor;
	name: string;
}

interface TagItem {
	color: string;
	id: string;
	name: string;
}

function TagForm({
	defaultValues,
	isLoading,
	onSubmit,
}: {
	defaultValues?: TagFormValues;
	isLoading?: boolean;
	onSubmit: (values: TagFormValues) => void;
}) {
	const [selectedColor, setSelectedColor] = useState<TagColor>(
		defaultValues?.color ?? "gray"
	);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		onSubmit({ name, color: selectedColor });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="tag-name">
					Tag Name <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.name}
					id="tag-name"
					maxLength={50}
					minLength={1}
					name="name"
					placeholder="Enter tag name"
					required
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label>Color</Label>
				<div className="flex flex-wrap gap-2">
					{TAG_COLOR_NAMES.map((color) => (
						<button
							aria-label={`Select ${color} color`}
							aria-pressed={selectedColor === color}
							className={`rounded-full border-2 p-0.5 ${selectedColor === color ? "border-foreground" : "border-transparent"}`}
							key={color}
							onClick={() => setSelectedColor(color)}
							type="button"
						>
							<ColorBadge color={color}>{color}</ColorBadge>
						</button>
					))}
				</div>
			</div>
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}

export function PlayerTagManager() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingTag, setEditingTag] = useState<TagItem | null>(null);
	const [deletingTag, setDeletingTag] = useState<TagItem | null>(null);

	const queryClient = useQueryClient();
	const tagListKey = trpc.playerTag.list.queryOptions().queryKey;

	const tagsQuery = useQuery(trpc.playerTag.list.queryOptions());
	const tags = tagsQuery.data ?? [];

	const createMutation = useMutation({
		mutationFn: (values: TagFormValues) =>
			trpcClient.playerTag.create.mutate(values),
		onMutate: async (newTag) => {
			await queryClient.cancelQueries({ queryKey: tagListKey });
			const previous = queryClient.getQueryData(tagListKey);
			queryClient.setQueryData(tagListKey, (old) => {
				if (!old) {
					return old;
				}
				const now = new Date().toISOString();
				return [
					...old,
					{
						id: `temp-${Date.now()}`,
						name: newTag.name,
						color: newTag.color,
						createdAt: now,
						updatedAt: now,
						userId: "",
					},
				];
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(tagListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: tagListKey });
		},
		onSuccess: () => {
			setIsCreateOpen(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: TagFormValues & { id: string }) =>
			trpcClient.playerTag.update.mutate(values),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({ queryKey: tagListKey });
			const previous = queryClient.getQueryData(tagListKey);
			queryClient.setQueryData(tagListKey, (old) =>
				old?.map((t) =>
					t.id === updated.id
						? { ...t, name: updated.name, color: updated.color }
						: t
				)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(tagListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: tagListKey });
			queryClient.invalidateQueries({
				queryKey: trpc.player.list.queryOptions().queryKey,
			});
		},
		onSuccess: () => {
			setEditingTag(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.playerTag.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: tagListKey });
			const previous = queryClient.getQueryData(tagListKey);
			queryClient.setQueryData(tagListKey, (old) =>
				old?.filter((t) => t.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(tagListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: tagListKey });
			queryClient.invalidateQueries({
				queryKey: trpc.player.list.queryOptions().queryKey,
			});
		},
		onSuccess: () => {
			setDeletingTag(null);
		},
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">
					{tags.length} {tags.length === 1 ? "tag" : "tags"}
				</p>
				<Button onClick={() => setIsCreateOpen(true)} size="sm">
					<IconPlus size={16} />
					New Tag
				</Button>
			</div>

			{tags.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					No tags yet. Create your first tag to categorize players.
				</p>
			) : (
				<div className="flex flex-col gap-2">
					{tags.map((tag) => (
						<div
							className="flex items-center justify-between rounded-md border p-3"
							key={tag.id}
						>
							<ColorBadge color={tag.color}>{tag.name}</ColorBadge>
							<div className="flex gap-1">
								<Button
									aria-label={`Edit tag ${tag.name}`}
									onClick={() => setEditingTag(tag)}
									size="sm"
									variant="ghost"
								>
									<IconEdit size={16} />
								</Button>
								<Button
									aria-label={`Delete tag ${tag.name}`}
									onClick={() => setDeletingTag(tag)}
									size="sm"
									variant="ghost"
								>
									<IconTrash size={16} />
								</Button>
							</div>
						</div>
					))}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="New Tag"
			>
				<TagForm
					isLoading={createMutation.isPending}
					onSubmit={(values) => createMutation.mutate(values)}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingTag(null);
					}
				}}
				open={editingTag !== null}
				title="Edit Tag"
			>
				{editingTag && (
					<TagForm
						defaultValues={{
							name: editingTag.name,
							color: editingTag.color as TagColor,
						}}
						isLoading={updateMutation.isPending}
						onSubmit={(values) =>
							updateMutation.mutate({ id: editingTag.id, ...values })
						}
					/>
				)}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setDeletingTag(null);
					}
				}}
				open={deletingTag !== null}
				title="Delete Tag"
			>
				{deletingTag && (
					<div className="flex flex-col gap-4">
						<p className="text-sm">
							Are you sure you want to delete the tag{" "}
							<ColorBadge color={deletingTag.color}>
								{deletingTag.name}
							</ColorBadge>
							? This will remove it from all players.
						</p>
						<div className="flex gap-2">
							<Button
								className="flex-1"
								onClick={() => setDeletingTag(null)}
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								className="flex-1"
								disabled={deleteMutation.isPending}
								onClick={() => deleteMutation.mutate(deletingTag.id)}
								variant="destructive"
							>
								{deleteMutation.isPending ? "Deleting..." : "Delete"}
							</Button>
						</div>
					</div>
				)}
			</ResponsiveDialog>
		</div>
	);
}
