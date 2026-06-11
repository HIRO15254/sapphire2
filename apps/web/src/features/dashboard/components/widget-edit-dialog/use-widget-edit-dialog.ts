import { useCallback, useState } from "react";

interface UseWidgetEditDialogOptions {
	onOpenChange: (open: boolean) => void;
	onSave: (nextConfig: Record<string, unknown>) => Promise<unknown> | undefined;
}

export function useWidgetEditDialog({
	onOpenChange,
	onSave,
}: UseWidgetEditDialogOptions) {
	const [isSaving, setIsSaving] = useState(false);

	const onFormSave = useCallback(
		async (nextConfig: Record<string, unknown>) => {
			setIsSaving(true);
			try {
				await onSave(nextConfig);
				onOpenChange(false);
			} catch {
				// Keep the sheet open so in-progress edits survive a failed
				// save and the user can retry. Surfacing the error (toast)
				// is the responsibility of the onSave owner.
			} finally {
				setIsSaving(false);
			}
		},
		[onOpenChange, onSave]
	);

	return { isSaving, onFormSave };
}
