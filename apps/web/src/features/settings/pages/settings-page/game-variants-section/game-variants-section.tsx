import { IconEdit, IconTrash } from "@tabler/icons-react";
import { FormSheet } from "@/shared/components/form-sheet";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { useGameVariantsSection } from "./use-game-variants-section";

const EDIT_VARIANT_FORM_ID = "edit-game-variant-form";

/**
 * Settings section listing every game variant row (seeded defaults plus any
 * the user renamed or created) with edit and delete actions. New variants
 * are created inline from the Variant select in a game form; this is the
 * one place to rename, re-group, or remove a definition. Past games and
 * sessions keep the frozen label string either way.
 */
export function GameVariantsSection() {
	const {
		variants,
		groups,
		isLoading,
		form,
		editingVariant,
		onEdit,
		onEditOpenChange,
		isUpdatePending,
		deletingVariant,
		onDeleteRequest,
		onDeleteConfirm,
		onDeleteCancel,
		isDeletePending,
	} = useGameVariantsSection();

	if (isLoading) {
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				Loading variants...
			</p>
		);
	}

	return (
		<>
			<div className="divide-y rounded-md border">
				{variants.map((variant) => (
					<div
						className="flex items-center justify-between gap-2 px-3 py-2"
						key={variant.id}
					>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<p className="truncate font-medium text-sm">{variant.label}</p>
								{variant.shortLabel ? (
									<span className="truncate text-muted-foreground text-xs">
										{variant.shortLabel}
									</span>
								) : null}
								{variant.builtinKey ? (
									<Badge variant="secondary">Default</Badge>
								) : null}
							</div>
							<p className="truncate text-muted-foreground text-xs">
								{variant.groupLabel}
							</p>
						</div>
						<div className="flex shrink-0 gap-1">
							<Button
								aria-label={`Edit ${variant.label}`}
								onClick={() => onEdit(variant)}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								<IconEdit size={14} />
							</Button>
							<Button
								aria-label={`Delete ${variant.label}`}
								className="text-muted-foreground hover:text-destructive"
								onClick={() => onDeleteRequest(variant)}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								<IconTrash size={14} />
							</Button>
						</div>
					</div>
				))}
			</div>

			<p className="pt-3 text-muted-foreground text-sm">
				New variants can be added from the Variant select in any game form.
			</p>

			<FormSheet
				formId={EDIT_VARIANT_FORM_ID}
				isLoading={isUpdatePending}
				onOpenChange={onEditOpenChange}
				open={editingVariant !== null}
				title="Edit game variant"
			>
				<form
					className="flex flex-col gap-3"
					id={EDIT_VARIANT_FORM_ID}
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
								htmlFor={`${EDIT_VARIANT_FORM_ID}-label`}
								label="Name"
								required
							>
								<Input
									id={`${EDIT_VARIANT_FORM_ID}-label`}
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
								htmlFor={`${EDIT_VARIANT_FORM_ID}-shortLabel`}
								label="Short label"
							>
								<Input
									id={`${EDIT_VARIANT_FORM_ID}-shortLabel`}
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
								htmlFor={`${EDIT_VARIANT_FORM_ID}-groupId`}
								label="Group"
								required
							>
								<Select
									onValueChange={(value) => field.handleChange(value)}
									value={field.state.value}
								>
									<SelectTrigger
										className="w-full"
										id={`${EDIT_VARIANT_FORM_ID}-groupId`}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{groups.map((group) => (
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

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						onDeleteCancel();
					}
				}}
				open={deletingVariant !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this variant?</DialogTitle>
						<DialogDescription>
							{deletingVariant?.label} will be removed from your variant list.
							Games and sessions that already used it keep the frozen name.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex-row justify-end gap-2">
						<Button onClick={onDeleteCancel} type="button" variant="outline">
							Cancel
						</Button>
						<Button
							disabled={isDeletePending}
							onClick={onDeleteConfirm}
							type="button"
							variant="destructive"
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
