import { FormSheet } from "@/shared/components/form-sheet";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import type { GameGroupOption, GameVariantRow } from "../use-games-page";
import { useVariantFormSheet } from "./use-variant-form-sheet";

const VARIANT_FORM_ID = "game-variant-form";

export interface VariantFormSheetProps {
	createGroupId: string | null;
	editingVariant: GameVariantRow | null;
	groups: GameGroupOption[];
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/**
 * Create AND edit share this sheet — see `use-variant-form-sheet.ts` for
 * the mode derivation and the create-mode groupId preselection contract.
 */
export function VariantFormSheet({
	createGroupId,
	editingVariant,
	groups,
	onOpenChange,
	open,
}: VariantFormSheetProps) {
	const {
		form,
		formTitle,
		groups: groupOptions,
		isPending,
		onOpenChange: handleOpenChange,
	} = useVariantFormSheet({
		createGroupId,
		editingVariant,
		groups,
		onOpenChange,
	});

	return (
		<FormSheet
			formId={VARIANT_FORM_ID}
			isLoading={isPending}
			onOpenChange={handleOpenChange}
			open={open}
			title={formTitle}
		>
			<form
				className="flex flex-col gap-3"
				id={VARIANT_FORM_ID}
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
							htmlFor={`${VARIANT_FORM_ID}-label`}
							label="Name"
							required
						>
							<Input
								id={`${VARIANT_FORM_ID}-label`}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="shortLabel">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={`${VARIANT_FORM_ID}-shortLabel`}
							label="Short label"
						>
							<Input
								id={`${VARIANT_FORM_ID}-shortLabel`}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="groupId">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={`${VARIANT_FORM_ID}-groupId`}
							label="Group"
							required
						>
							<Select
								onValueChange={(value) => field.handleChange(value)}
								value={field.state.value}
							>
								<SelectTrigger
									className="w-full"
									id={`${VARIANT_FORM_ID}-groupId`}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{groupOptions.map((group) => (
										<SelectItem key={group.id} value={group.id}>
											{group.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
				</form.Field>
			</form>
		</FormSheet>
	);
}
