import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import type { ChipPurchaseOption } from "./use-chip-purchase-option-editor";
import { useChipPurchaseOptionEditor } from "./use-chip-purchase-option-editor";

interface ChipPurchaseOptionEditorProps {
	isReadOnly: boolean;
	options: ChipPurchaseOption[];
	sessionId: string;
}

function OptionForm({
	form,
	onCancel,
	isPending,
	submitLabel,
}: {
	form: ReturnType<typeof useChipPurchaseOptionEditor>["addForm" | "editForm"];
	isPending: boolean;
	onCancel: () => void;
	submitLabel: string;
}) {
	return (
		<form
			className="flex flex-col gap-2 rounded-md border p-3"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div className="grid grid-cols-3 gap-2">
				<form.Field name="name">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Name"
							required
						>
							<Input
								id={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="cost">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Cost"
							required
						>
							<Input
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="chips">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Chips"
							required
						>
							<Input
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			</div>
			<div className="flex justify-end gap-2">
				<Button onClick={onCancel} size="sm" type="button" variant="outline">
					Cancel
				</Button>
				<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<Button
							disabled={isPending || !canSubmit || isSubmitting}
							size="sm"
							type="submit"
						>
							{isPending ? "Saving..." : submitLabel}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

export function ChipPurchaseOptionEditor({
	isReadOnly,
	options,
	sessionId,
}: ChipPurchaseOptionEditorProps) {
	const {
		addForm,
		editForm,
		editingId,
		isAddOpen,
		setIsAddOpen,
		openEdit,
		closeEdit,
		isAddPending,
		isUpdatePending,
		isRemovePending,
		onRemove,
	} = useChipPurchaseOptionEditor({ sessionId, options, isReadOnly });

	return (
		<div className="flex flex-col gap-3">
			{options.length > 0 ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Cost</TableHead>
							<TableHead>Chips</TableHead>
							{!isReadOnly && <TableHead />}
						</TableRow>
					</TableHeader>
					<TableBody>
						{options.map((opt) => (
							<TableRow key={opt.id}>
								{editingId === opt.id ? (
									<TableCell className="p-0" colSpan={isReadOnly ? 3 : 4}>
										<OptionForm
											form={editForm}
											isPending={isUpdatePending}
											onCancel={closeEdit}
											submitLabel="Save"
										/>
									</TableCell>
								) : (
									<>
										<TableCell>{opt.name}</TableCell>
										<TableCell>{opt.cost}</TableCell>
										<TableCell>{opt.chips}</TableCell>
										{!isReadOnly && (
											<TableCell className="w-16">
												<div className="flex gap-1">
													<Button
														onClick={() => openEdit(opt)}
														size="xs"
														type="button"
														variant="ghost"
													>
														Edit
													</Button>
													<Button
														disabled={isRemovePending}
														onClick={() => onRemove(opt.id)}
														size="xs"
														type="button"
														variant="ghost"
													>
														<IconTrash className="h-3 w-3" />
													</Button>
												</div>
											</TableCell>
										)}
									</>
								)}
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : (
				<p className="text-muted-foreground text-sm">
					No chip purchase options yet.
				</p>
			)}

			{!isReadOnly &&
				(isAddOpen ? (
					<OptionForm
						form={addForm}
						isPending={isAddPending}
						onCancel={() => setIsAddOpen(false)}
						submitLabel="Add Option"
					/>
				) : (
					<Button
						className="self-start"
						onClick={() => setIsAddOpen(true)}
						size="sm"
						type="button"
						variant="outline"
					>
						<IconPlus className="mr-1 h-4 w-4" />
						Add Option
					</Button>
				))}
		</div>
	);
}
