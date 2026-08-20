import { TagNameForm } from "@/shared/components/management/tag-name-form";
import { Button } from "@/shared/components/ui/button";
import type { FilterPresetItem } from "@/shared/hooks/use-filter-presets";

const EDIT_PRESET_FORM_ID = "filter-presets-edit-form";

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
