import { TagNameForm } from "@/shared/components/management/tag-name-form";
import { Button } from "@/shared/components/ui/button";
import type { FilterPresetItem } from "@/shared/hooks/use-filter-presets";

const EDIT_PRESET_FORM_ID = "filter-presets-edit-form";

/**
 * Replaces the Saved tab's body while a preset is being edited (no third tab —
 * this is a drill-down out of a row, not a peer of "Saved" / "Save new").
 * Submitting renames the preset *and* overwrites its stored filters, so the
 * body copy has to say so before the user taps Save.
 */
export function EditPresetForm({
	isPending,
	onCancel,
	onSubmit,
	preset,
}: {
	isPending: boolean;
	onCancel: () => void;
	onSubmit: (name: string) => void;
	preset: FilterPresetItem;
}) {
	return (
		<div className="flex flex-col gap-4">
			<p className="t-body-sm text-muted-foreground">
				Saving renames this preset and replaces its saved filters with the
				filters you have applied right now.
			</p>
			<TagNameForm
				defaultName={preset.name}
				formId={EDIT_PRESET_FORM_ID}
				key={preset.id}
				label="Preset name"
				onSubmit={onSubmit}
			/>
			<div className="flex gap-2">
				<Button
					className="flex-1"
					onClick={onCancel}
					type="button"
					variant="outline"
				>
					Cancel
				</Button>
				<Button
					className="flex-1"
					disabled={isPending}
					form={EDIT_PRESET_FORM_ID}
					type="submit"
				>
					{isPending ? "Saving..." : "Save"}
				</Button>
			</div>
		</div>
	);
}
