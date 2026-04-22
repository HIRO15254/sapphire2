import { useState } from "react";
import type { TagColor } from "@/players/constants/player-tag-colors";
import type { TagFormValues } from "@/players/hooks/use-player-tags";

interface UseTagFormProps {
	defaultValues?: TagFormValues;
}

export function useTagForm({ defaultValues }: UseTagFormProps) {
	const [selectedColor, setSelectedColor] = useState<TagColor>(
		defaultValues?.color ?? "gray"
	);

	return {
		onColorChange: setSelectedColor,
		selectedColor,
	};
}
