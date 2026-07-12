import { FormSheet } from "@/shared/components/form-sheet";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { GameGroupRow } from "../use-game-library-section";
import { useGroupFormSheet } from "./use-group-form-sheet";

const GROUP_FORM_ID = "game-group-form";

const BLIND_LABEL_FIELDS = [
	{ name: "blind1Label", label: "Blind 1 label" },
	{ name: "blind2Label", label: "Blind 2 label" },
	{ name: "blind3Label", label: "Blind 3 label" },
] as const;

export interface GroupFormSheetProps {
	editingGroup: GameGroupRow | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/**
 * Create AND edit share this sheet — see `use-group-form-sheet.ts` for the
 * mode derivation and the parent's key-per-target remount contract.
 */
export function GroupFormSheet({
	editingGroup,
	onOpenChange,
	open,
}: GroupFormSheetProps) {
	const {
		form,
		formTitle,
		isPending,
		onOpenChange: handleOpenChange,
	} = useGroupFormSheet({ editingGroup, onOpenChange });

	return (
		<FormSheet
			formId={GROUP_FORM_ID}
			isLoading={isPending}
			onOpenChange={handleOpenChange}
			open={open}
			title={formTitle}
		>
			<form
				className="flex flex-col gap-3"
				id={GROUP_FORM_ID}
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="label">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={`${GROUP_FORM_ID}-label`}
							label="Name"
							required
						>
							<Input
								id={`${GROUP_FORM_ID}-label`}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				{/* 3-up leaves ~100px per text input on a phone-width sheet —
				    stack there, resume the row from sm up. */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{BLIND_LABEL_FIELDS.map(({ name, label }) => (
						<form.Field key={name} name={name}>
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={`${GROUP_FORM_ID}-${name}`}
									label={label}
								>
									<Input
										id={`${GROUP_FORM_ID}-${name}`}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>
					))}
				</div>
			</form>
		</FormSheet>
	);
}
