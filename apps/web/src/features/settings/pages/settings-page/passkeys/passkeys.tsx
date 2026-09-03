import { IconKey, IconPencil, IconTrash } from "@tabler/icons-react";
import { FormSheet } from "@/shared/components/form-sheet";
import {
	ManagementList,
	ManagementListItem,
} from "@/shared/components/management/management-list";
import { TagNameForm } from "@/shared/components/management/tag-name-form";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { formatLocalYmdSlash } from "@/utils/format-number";
import { useAddPasskeyForm } from "./use-add-passkey-form";
import { usePasskeys } from "./use-passkeys";

const ADD_PASSKEY_FORM_ID = "add-passkey-form";
const RENAME_PASSKEY_FORM_ID = "rename-passkey-form";

function AddPasskeyForm({
	formId,
	onOpenChange,
	onSuccess,
}: {
	formId: string;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}) {
	const { form } = useAddPasskeyForm({ onOpenChange, onSuccess });

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<p className="text-muted-foreground text-sm">
				Your device will ask you to confirm with a fingerprint, face, screen
				lock, or security key. Name it so you can tell your devices apart later.
			</p>

			<form.Field name="name">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Passkey name"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</form>
	);
}

export function Passkeys() {
	const {
		error,
		isAddOpen,
		isPasskeySupported,
		loading,
		onAddOpenChange,
		onDeletePasskey,
		onRenamePasskey,
		onRenameTargetChange,
		passkeys,
		refreshPasskeys,
		renameTarget,
		totalPasskeys,
	} = usePasskeys();

	if (loading) {
		return (
			<div className="text-muted-foreground text-sm">Loading passkeys...</div>
		);
	}

	if (error) {
		return (
			<div className="text-destructive text-sm" role="alert">
				{error}
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{totalPasskeys === 0 ? (
				<p className="text-muted-foreground text-sm">
					No passkeys yet. Add one to sign in without a password.
				</p>
			) : (
				<ManagementList>
					{passkeys.map((entry) => (
						<ManagementListItem
							actions={
								<div className="flex items-center gap-2">
									<Button
										aria-label={`Rename ${entry.name || "passkey"}`}
										onClick={() => onRenameTargetChange(entry)}
										size="sm"
										variant="outline"
									>
										<IconPencil />
										Rename
									</Button>
									<Button
										aria-label={`Remove ${entry.name || "passkey"}`}
										onClick={() => onDeletePasskey(entry.id)}
										size="sm"
										variant="outline"
									>
										<IconTrash />
										Remove
									</Button>
								</div>
							}
							className="min-h-14"
							description={`Added ${formatLocalYmdSlash(entry.createdAt)}`}
							key={entry.id}
							leading={<IconKey className="h-4 w-4" />}
							title={
								<span className="flex items-center gap-2">
									{entry.name || "Passkey"}
									{entry.backedUp ? (
										<Badge variant="outline">Synced</Badge>
									) : null}
								</span>
							}
						/>
					))}
				</ManagementList>
			)}

			{isPasskeySupported ? (
				<Button onClick={() => onAddOpenChange(true)} variant="outline">
					<IconKey />
					Add passkey
				</Button>
			) : (
				<p className="text-muted-foreground text-xs">
					This browser does not support passkeys.
				</p>
			)}

			<FormSheet
				formId={ADD_PASSKEY_FORM_ID}
				onOpenChange={onAddOpenChange}
				open={isAddOpen}
				title="Add passkey"
			>
				<AddPasskeyForm
					formId={ADD_PASSKEY_FORM_ID}
					onOpenChange={onAddOpenChange}
					onSuccess={refreshPasskeys}
				/>
			</FormSheet>

			<FormSheet
				formId={RENAME_PASSKEY_FORM_ID}
				onOpenChange={(open) => {
					if (!open) {
						onRenameTargetChange(null);
					}
				}}
				open={renameTarget !== null}
				title="Rename passkey"
			>
				<TagNameForm
					defaultName={renameTarget?.name ?? ""}
					formId={RENAME_PASSKEY_FORM_ID}
					key={renameTarget?.id}
					label="Passkey name"
					onSubmit={onRenamePasskey}
				/>
			</FormSheet>
		</div>
	);
}
