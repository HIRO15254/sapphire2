import { useState } from "react";
import { PlayerTagInput } from "@/components/players/player-tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

export interface PlayerFormValues {
	name: string;
	tagIds?: string[];
}

interface PlayerFormProps {
	availableTags?: TagWithColor[];
	defaultTags?: TagWithColor[];
	defaultValues?: { name: string };
	isLoading?: boolean;
	onCreateTag?: (name: string) => Promise<TagWithColor>;
	onSubmit: (values: PlayerFormValues) => void;
}

export function PlayerForm({
	availableTags,
	defaultTags,
	defaultValues,
	isLoading = false,
	onCreateTag,
	onSubmit,
}: PlayerFormProps) {
	const [selectedTags, setSelectedTags] = useState<TagWithColor[]>(
		defaultTags ?? []
	);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		onSubmit({
			name,
			tagIds:
				selectedTags.length > 0 ? selectedTags.map((t) => t.id) : undefined,
		});
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="name">
					Player Name <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.name}
					id="name"
					minLength={1}
					name="name"
					placeholder="Enter player name"
					required
				/>
			</div>
			{availableTags && (
				<div className="flex flex-col gap-2">
					<Label>Tags</Label>
					<PlayerTagInput
						availableTags={availableTags}
						onAdd={(tag) => setSelectedTags((prev) => [...prev, tag])}
						onCreateTag={onCreateTag}
						onRemove={(tag) =>
							setSelectedTags((prev) => prev.filter((t) => t.id !== tag.id))
						}
						selectedTags={selectedTags}
					/>
				</div>
			)}
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
