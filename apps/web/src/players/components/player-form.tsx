import { useRef, useState } from "react";
import { PlayerTagInput } from "@/players/components/player-tag-input";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { RichTextEditor } from "@/shared/components/ui/rich-text-editor";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

export interface PlayerFormValues {
	memo?: string | null;
	name: string;
	tagIds?: string[];
}

interface PlayerFormProps {
	availableTags?: TagWithColor[];
	defaultMemo?: string | null;
	defaultTags?: TagWithColor[];
	defaultValues?: { name: string };
	isLoading?: boolean;
	onCreateTag?: (name: string) => Promise<TagWithColor>;
	onSubmit: (values: PlayerFormValues) => void;
}

export function PlayerForm({
	availableTags,
	defaultMemo,
	defaultTags,
	defaultValues,
	isLoading = false,
	onCreateTag,
	onSubmit,
}: PlayerFormProps) {
	const [selectedTags, setSelectedTags] = useState<TagWithColor[]>(
		defaultTags ?? []
	);
	const memoRef = useRef<string | null>(defaultMemo ?? null);

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		onSubmit({
			name,
			memo: memoRef.current,
			tagIds:
				selectedTags.length > 0 ? selectedTags.map((t) => t.id) : undefined,
		});
	};

	const handleMemoChange = (html: string) => {
		memoRef.current = html || null;
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="name" label="Player Name" required>
				<Input
					defaultValue={defaultValues?.name}
					id="name"
					minLength={1}
					name="name"
					placeholder="Enter player name"
					required
				/>
			</Field>
			{availableTags && (
				<Field label="Tags">
					<PlayerTagInput
						availableTags={availableTags}
						onAdd={(tag) => setSelectedTags((prev) => [...prev, tag])}
						onCreateTag={onCreateTag}
						onRemove={(tag) =>
							setSelectedTags((prev) => prev.filter((t) => t.id !== tag.id))
						}
						selectedTags={selectedTags}
					/>
				</Field>
			)}
			<Field label="Memo">
				<RichTextEditor
					initialContent={defaultMemo}
					onChange={handleMemoChange}
				/>
			</Field>
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
