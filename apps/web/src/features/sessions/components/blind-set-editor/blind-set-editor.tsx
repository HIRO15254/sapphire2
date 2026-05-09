import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import type { BlindLevel, BlindSet, LimitFormat } from "./use-blind-set-editor";
import { useBlindSetEditor } from "./use-blind-set-editor";

interface BlindSetEditorProps {
	blindLevels?: BlindLevel[];
	cashBlindSets?: BlindSet[];
	isReadOnly: boolean;
	kind: "tournament" | "cash_game";
	sessionId: string;
}

function BlindSetFormFields({
	form,
	limitFormats,
	isPending,
	onCancel,
	submitLabel,
}: {
	form: ReturnType<typeof useBlindSetEditor>["addBlindSetForm"];
	isPending: boolean;
	limitFormats: LimitFormat[];
	onCancel: () => void;
	submitLabel: string;
}) {
	const selectedLf = (limitFormatId: string) =>
		limitFormats.find((lf) => lf.id === Number(limitFormatId));

	return (
		<form
			className="flex flex-col gap-3 rounded-md border p-3"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="limitFormatId">
				{(field) => (
					<Field
						error={
							(field.state.meta.errors[0] as { message?: string } | undefined)
								?.message
						}
						htmlFor={field.name}
						label="Limit Format"
						required
					>
						<SelectWithClear
							onValueChange={(v) => field.handleChange(v ?? "")}
							value={field.state.value}
						>
							<SelectTrigger id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{limitFormats.map((lf) => (
									<SelectItem key={lf.id} value={String(lf.id)}>
										{lf.name}
									</SelectItem>
								))}
							</SelectContent>
						</SelectWithClear>
					</Field>
				)}
			</form.Field>

			<form.Subscribe selector={(s) => s.values.limitFormatId}>
				{(lfId) => {
					const lf = selectedLf(lfId);
					return (
						<div className="grid grid-cols-2 gap-2">
							<form.Field name="blind1">
								{(field) => (
									<Field
										error={
											(
												field.state.meta.errors[0] as
													| { message?: string }
													| undefined
											)?.message
										}
										htmlFor={field.name}
										label={lf?.blind1Label ?? "Blind 1"}
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
							<form.Field name="blind2">
								{(field) => (
									<Field
										error={
											(
												field.state.meta.errors[0] as
													| { message?: string }
													| undefined
											)?.message
										}
										htmlFor={field.name}
										label={lf?.blind2Label ?? "Blind 2"}
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
							{lf?.blind3Label ? (
								<form.Field name="blind3">
									{(field) => (
										<Field
											error={
												(
													field.state.meta.errors[0] as
														| { message?: string }
														| undefined
												)?.message
											}
											htmlFor={field.name}
											label={lf.blind3Label ?? "Blind 3"}
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
							) : null}
							{lf?.blind4Label ? (
								<form.Field name="blind4">
									{(field) => (
										<Field
											error={
												(
													field.state.meta.errors[0] as
														| { message?: string }
														| undefined
												)?.message
											}
											htmlFor={field.name}
											label={lf.blind4Label ?? "Blind 4"}
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
							) : null}
							<form.Field name="ante">
								{(field) => (
									<Field
										error={
											(
												field.state.meta.errors[0] as
													| { message?: string }
													| undefined
											)?.message
										}
										htmlFor={field.name}
										label="Ante"
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
					);
				}}
			</form.Subscribe>

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

function LevelFormFields({
	form,
	isPending,
	onCancel,
	submitLabel,
}: {
	form: ReturnType<typeof useBlindSetEditor>["addLevelForm"];
	isPending: boolean;
	onCancel: () => void;
	submitLabel: string;
}) {
	return (
		<form
			className="flex flex-col gap-3 rounded-md border p-3"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div className="grid grid-cols-2 gap-2">
				<form.Field name="levelIndex">
					{(field) => (
						<Field
							error={
								(field.state.meta.errors[0] as { message?: string } | undefined)
									?.message
							}
							htmlFor={field.name}
							label="Level #"
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
				<form.Field name="minutes">
					{(field) => (
						<Field
							error={
								(field.state.meta.errors[0] as { message?: string } | undefined)
									?.message
							}
							htmlFor={field.name}
							label="Minutes"
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
			<form.Field name="isBreak">
				{(field) => (
					<div className="flex items-center gap-2">
						<Checkbox
							checked={field.state.value}
							id={field.name}
							onCheckedChange={(v) => field.handleChange(v === true)}
						/>
						<Label htmlFor={field.name}>Break level</Label>
					</div>
				)}
			</form.Field>
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

function BlindSetRow({
	bs,
	limitFormats,
	isReadOnly,
	isEditing,
	editForm,
	isUpdatePending,
	isRemovePending,
	onEdit,
	onRemove,
	onCancelEdit,
}: {
	bs: BlindSet;
	editForm: ReturnType<typeof useBlindSetEditor>["editBlindSetForm"];
	isEditing: boolean;
	isReadOnly: boolean;
	isRemovePending: boolean;
	isUpdatePending: boolean;
	limitFormats: LimitFormat[];
	onCancelEdit: () => void;
	onEdit: () => void;
	onRemove: () => void;
}) {
	const lf = limitFormats.find((f) => f.id === bs.limitFormatId);

	if (isEditing) {
		return (
			<BlindSetFormFields
				form={editForm}
				isPending={isUpdatePending}
				limitFormats={limitFormats}
				onCancel={onCancelEdit}
				submitLabel="Save"
			/>
		);
	}

	return (
		<div className="flex items-start justify-between gap-2 rounded-sm bg-muted/40 px-2 py-1 text-sm">
			<div className="flex flex-wrap gap-1">
				<Badge variant="outline">
					{lf?.name ?? `Format ${bs.limitFormatId}`}
				</Badge>
				<span>
					{bs.blind1}/{bs.blind2}
					{bs.blind3 == null ? "" : `/${bs.blind3}`}
					{bs.blind4 == null ? "" : `/${bs.blind4}`}
					{bs.ante != null && bs.ante > 0 ? ` ante ${bs.ante}` : ""}
				</span>
			</div>
			{!isReadOnly && (
				<div className="flex shrink-0 gap-1">
					<Button onClick={onEdit} size="xs" type="button" variant="ghost">
						Edit
					</Button>
					<Button
						disabled={isRemovePending}
						onClick={onRemove}
						size="xs"
						type="button"
						variant="ghost"
					>
						<IconTrash className="h-3 w-3" />
					</Button>
				</div>
			)}
		</div>
	);
}

export function BlindSetEditor({
	blindLevels,
	cashBlindSets,
	isReadOnly,
	kind,
	sessionId,
}: BlindSetEditorProps) {
	const {
		limitFormats,
		addBlindSetTarget,
		setAddBlindSetTarget,
		editingBlindSetId,
		isAddLevelOpen,
		setIsAddLevelOpen,
		editingLevelId,
		addBlindSetForm,
		editBlindSetForm,
		addLevelForm,
		editLevelForm,
		isAddBlindSetPending,
		isUpdateBlindSetPending,
		isRemoveBlindSetPending,
		isAddLevelPending,
		isUpdateLevelPending,
		isRemoveLevelPending,
		openEditBlindSet,
		openEditLevel,
		closeEditBlindSet,
		closeEditLevel,
		onRemoveBlindSet,
		onRemoveLevel,
	} = useBlindSetEditor({
		sessionId,
		kind,
		blindLevels,
		cashBlindSets,
		isReadOnly,
	});

	if (kind === "cash_game") {
		const sets = cashBlindSets ?? [];
		return (
			<div className="flex flex-col gap-2">
				<p className="text-muted-foreground text-xs">
					Cash blind sets ({sets.length})
				</p>
				{sets.map((bs) => (
					<BlindSetRow
						bs={bs}
						editForm={editBlindSetForm}
						isEditing={editingBlindSetId?.id === bs.id}
						isReadOnly={isReadOnly}
						isRemovePending={isRemoveBlindSetPending}
						isUpdatePending={isUpdateBlindSetPending}
						key={bs.id}
						limitFormats={limitFormats}
						onCancelEdit={closeEditBlindSet}
						onEdit={() => openEditBlindSet(bs, "cash")}
						onRemove={() => onRemoveBlindSet(bs.id, "cash")}
					/>
				))}

				{!isReadOnly &&
					(addBlindSetTarget === "cash" ? (
						<BlindSetFormFields
							form={addBlindSetForm}
							isPending={isAddBlindSetPending}
							limitFormats={limitFormats}
							onCancel={() => setAddBlindSetTarget(null)}
							submitLabel="Add Blind Set"
						/>
					) : (
						<Button
							className="self-start"
							onClick={() => setAddBlindSetTarget("cash")}
							size="sm"
							type="button"
							variant="outline"
						>
							<IconPlus className="mr-1 h-4 w-4" />
							Add Blind Set
						</Button>
					))}
			</div>
		);
	}

	// Tournament mode
	const levels = blindLevels ?? [];
	return (
		<div className="flex flex-col gap-3">
			{levels.map((level) => (
				<div
					className="flex flex-col gap-2 rounded-md border p-3"
					key={level.id}
				>
					{editingLevelId === level.id ? (
						<LevelFormFields
							form={editLevelForm}
							isPending={isUpdateLevelPending}
							onCancel={closeEditLevel}
							submitLabel="Save Level"
						/>
					) : (
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Badge variant={level.isBreak ? "secondary" : "default"}>
									{level.isBreak ? "Break" : `Level ${level.levelIndex}`}
								</Badge>
								{level.minutes != null && (
									<span className="text-muted-foreground text-xs">
										{level.minutes} min
									</span>
								)}
							</div>
							{!isReadOnly && (
								<div className="flex gap-1">
									<Button
										onClick={() => openEditLevel(level)}
										size="xs"
										type="button"
										variant="ghost"
									>
										Edit
									</Button>
									<Button
										disabled={isRemoveLevelPending}
										onClick={() => onRemoveLevel(level.id)}
										size="xs"
										type="button"
										variant="ghost"
									>
										<IconTrash className="h-3 w-3" />
									</Button>
								</div>
							)}
						</div>
					)}

					{!level.isBreak && (
						<div className="flex flex-col gap-1 pl-2">
							{level.blindSets.map((bs) => (
								<BlindSetRow
									bs={bs}
									editForm={editBlindSetForm}
									isEditing={editingBlindSetId?.id === bs.id}
									isReadOnly={isReadOnly}
									isRemovePending={isRemoveBlindSetPending}
									isUpdatePending={isUpdateBlindSetPending}
									key={bs.id}
									limitFormats={limitFormats}
									onCancelEdit={closeEditBlindSet}
									onEdit={() => openEditBlindSet(bs, "tournament")}
									onRemove={() => onRemoveBlindSet(bs.id, "tournament")}
								/>
							))}

							{!isReadOnly &&
								(addBlindSetTarget === level.id ? (
									<BlindSetFormFields
										form={addBlindSetForm}
										isPending={isAddBlindSetPending}
										limitFormats={limitFormats}
										onCancel={() => setAddBlindSetTarget(null)}
										submitLabel="Add Blind Set"
									/>
								) : (
									<Button
										className="self-start"
										onClick={() => setAddBlindSetTarget(level.id)}
										size="xs"
										type="button"
										variant="ghost"
									>
										<IconPlus className="mr-1 h-3 w-3" />
										Add blind set
									</Button>
								))}
						</div>
					)}
				</div>
			))}

			{!isReadOnly &&
				(isAddLevelOpen ? (
					<LevelFormFields
						form={addLevelForm}
						isPending={isAddLevelPending}
						onCancel={() => setIsAddLevelOpen(false)}
						submitLabel="Add Level"
					/>
				) : (
					<Button
						className="self-start"
						onClick={() => setIsAddLevelOpen(true)}
						size="sm"
						type="button"
						variant="outline"
					>
						<IconPlus className="mr-1 h-4 w-4" />
						Add Level
					</Button>
				))}
		</div>
	);
}
