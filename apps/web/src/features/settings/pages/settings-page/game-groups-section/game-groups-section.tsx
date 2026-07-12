import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
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
import { useGameGroupsSection } from "./use-game-groups-section";

const GROUP_FORM_ID = "game-group-form";

const BLIND_LABEL_FIELDS = [
	{ name: "blind1Label", label: "Blind 1 label" },
	{ name: "blind2Label", label: "Blind 2 label" },
	{ name: "blind3Label", label: "Blind 3 label" },
] as const;

/**
 * Settings section listing every game group row (seeded defaults plus any
 * the user created) with add, edit, and delete actions. A group cannot be
 * deleted while a variant still references it — the server rejects with
 * CONFLICT and the hook surfaces a dedicated toast.
 */
export function GameGroupsSection() {
	const {
		groups,
		isLoading,
		form,
		isFormOpen,
		formTitle,
		isFormPending,
		onAdd,
		onEdit,
		onFormOpenChange,
		deletingGroup,
		onDeleteRequest,
		onDeleteConfirm,
		onDeleteCancel,
		isDeletePending,
	} = useGameGroupsSection();

	if (isLoading) {
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				Loading groups...
			</p>
		);
	}

	return (
		<>
			<div className="mb-3 flex justify-end">
				<Button onClick={onAdd} size="sm" type="button">
					<IconPlus size={16} />
					Add group
				</Button>
			</div>

			<div className="divide-y rounded-md border">
				{groups.map((group) => (
					<div
						className="flex items-center justify-between gap-2 px-3 py-2"
						key={group.id}
					>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<p className="truncate font-medium text-sm">{group.label}</p>
								{group.builtinKey ? (
									<Badge variant="secondary">Default</Badge>
								) : null}
							</div>
							<p className="truncate text-muted-foreground text-xs">
								{group.slotSummary}
							</p>
						</div>
						<div className="flex shrink-0 gap-1">
							<Button
								aria-label={`Edit ${group.label}`}
								onClick={() => onEdit(group)}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								<IconEdit size={14} />
							</Button>
							<Button
								aria-label={`Delete ${group.label}`}
								className="text-muted-foreground hover:text-destructive"
								onClick={() => onDeleteRequest(group)}
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

			<FormSheet
				formId={GROUP_FORM_ID}
				isLoading={isFormPending}
				onOpenChange={onFormOpenChange}
				open={isFormOpen}
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
					<div className="grid grid-cols-3 gap-3">
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

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						onDeleteCancel();
					}
				}}
				open={deletingGroup !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this group?</DialogTitle>
						<DialogDescription>
							{deletingGroup?.label} will be removed from your group list. This
							is only possible while no variant uses it.
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
