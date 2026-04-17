import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function StackBadgeRow({
	children,
	className,
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex min-h-0 flex-wrap items-center gap-1.5 overflow-x-auto pb-1",
				className
			)}
		>
			{children}
		</div>
	);
}

export function StackPrimaryRow({
	children,
	className,
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end",
				className
			)}
		>
			{children}
		</div>
	);
}

export function StackSecondaryGrid({
	children,
	className,
}: React.ComponentProps<"div">) {
	return (
		<div className={cn("grid gap-2 sm:grid-cols-2", className)}>{children}</div>
	);
}

export function StackQuickActions({
	children,
	className,
}: React.ComponentProps<"div">) {
	return (
		<div className={cn("flex flex-wrap gap-2", className)}>{children}</div>
	);
}

export function StackSectionHeader({
	action,
	title,
}: {
	action?: React.ReactNode;
	title: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-2">
			<Label>{title}</Label>
			{action}
		</div>
	);
}

export function StackTimeField({
	error,
	id = "edit-time",
	onChange,
	value,
}: {
	error?: React.ReactNode;
	id?: string;
	onChange: (value: string) => void;
	value: string;
}) {
	return (
		<Field error={error} htmlFor={id} label="Time">
			<Input
				id={id}
				onChange={(event) => onChange(event.target.value)}
				type="time"
				value={value}
			/>
		</Field>
	);
}

export function StackNumberField({
	description,
	error,
	id,
	label,
	onChange,
	required = false,
	value,
	...props
}: Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> & {
	description?: React.ReactNode;
	error?: React.ReactNode;
	id: string;
	label: React.ReactNode;
	onChange: (value: string) => void;
	required?: boolean;
	value: string;
}) {
	return (
		<Field
			description={description}
			error={error}
			htmlFor={id}
			label={label}
			required={required}
		>
			<Input
				{...props}
				id={id}
				onChange={(event) => onChange(event.target.value)}
				value={value}
			/>
		</Field>
	);
}

export function StackEditorActionRow({
	deleteLabel = "Delete",
	isLoading,
	onDelete,
	onSave,
	saveDisabled = false,
	saveLabel = "Save",
}: {
	deleteLabel?: string;
	isLoading: boolean;
	onDelete?: () => void;
	onSave: () => void;
	saveDisabled?: boolean;
	saveLabel?: string;
}) {
	return (
		<DialogActionRow>
			{onDelete ? (
				<Button onClick={onDelete} type="button" variant="destructive">
					{deleteLabel}
				</Button>
			) : null}
			<Button
				disabled={isLoading || saveDisabled}
				onClick={onSave}
				type="button"
			>
				{isLoading ? "Saving..." : saveLabel}
			</Button>
		</DialogActionRow>
	);
}
