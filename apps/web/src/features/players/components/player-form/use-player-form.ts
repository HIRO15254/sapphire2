import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { PlayerFormValues } from "./player-form";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

interface UsePlayerFormProps {
	defaultMemo?: string | null;
	defaultTags?: TagWithColor[];
	defaultValues?: { name: string };
	onSubmit: (values: PlayerFormValues) => void;
}

export const playerFormSchema = z.object({
	memo: z.string().max(50_000).nullable(),
	name: z
		.string()
		.min(1, "Name is required")
		.max(100, "Name must be 100 characters or less"),
	tags: z.array(
		z.object({ color: z.string(), id: z.string(), name: z.string() })
	),
});

export function usePlayerForm({
	defaultMemo,
	defaultTags,
	defaultValues,
	onSubmit,
}: UsePlayerFormProps) {
	const form = useForm({
		defaultValues: {
			memo: defaultMemo ?? (null as string | null),
			name: defaultValues?.name ?? "",
			tags: defaultTags ?? ([] as TagWithColor[]),
		},
		onSubmit: ({ value }) => {
			onSubmit({
				memo: value.memo,
				name: value.name,
				tagIds: value.tags.length > 0 ? value.tags.map((t) => t.id) : undefined,
			});
		},
		validators: {
			onSubmit: playerFormSchema,
		},
	});

	return { form };
}
