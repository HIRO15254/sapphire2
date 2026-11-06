import {
	IconDots,
	IconKey,
	IconPencil,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { SectionLoadError } from "@/features/settings/pages/settings-page/section-load-error";
import { SettingsSection } from "@/features/settings/pages/settings-page/settings-section";
import { FormSheet } from "@/shared/components/form-sheet";
import { TagNameForm } from "@/shared/components/management/tag-name-form";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import {
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerDescription,
	DrawerGrab,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/shared/components/ui/item";
import { Spinner } from "@/shared/components/ui/spinner";
import { formatLocalYmdSlash } from "@/utils/format-number";
import { useAddPasskeyForm } from "./use-add-passkey-form";
import { usePasskeys } from "./use-passkeys";

const ADD_PASSKEY_FORM_ID = "add-passkey-form";
const RENAME_PASSKEY_FORM_ID = "rename-passkey-form";

function AddPasskeyForm({
	errorMessage,
	form,
	formId,
	onSubmit,
	onFieldChange,
}: {
	errorMessage: string | null;
	form: ReturnType<typeof useAddPasskeyForm>["form"];
	formId: string;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	onFieldChange: (field: {
		handleChange: (value: string) => void;
	}) => (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
	return (
		<form
			className="flex flex-col gap-4 pt-1 pb-2"
			id={formId}
			noValidate
			onSubmit={onSubmit}
		>
			{errorMessage ? (
				<Alert variant="destructive">
					<AlertTitle>Couldn't add the passkey</AlertTitle>
					<AlertDescription>{errorMessage}</AlertDescription>
				</Alert>
			) : null}
			<p className="text-muted-foreground m-0 leading-normal">
				Your device asks for your face, fingerprint or screen lock next.
			</p>

			<form.Field name="name">
				{(field) => (
					<Field
						description="So you can tell your devices apart."
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Name"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={onFieldChange(field)}
							size="xl"
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</form>
	);
}

function passkeyDescription(createdAt: Date | string, backedUp?: boolean) {
	const added = `Added ${formatLocalYmdSlash(createdAt)}`;
	return backedUp ? `${added} · Synced` : added;
}

export function Passkeys() {
	const {
		deleteTarget,
		error,
		isAddOpen,
		isDeletePending,
		isPasskeySupported,
		isRefreshPending,
		isRenamePending,
		loading,
		menuTarget,
		onAddOpenChange,
		onSelectPasskey,
		onOpenAdd,
		onCloseMenu,
		onMenuOpenChange,
		onRenameOpenChange,
		onDeleteOpenChange,
		onCancelDelete,
		onDeletePasskey,
		onRemoveFromMenu,
		onRenameFromMenu,
		onRenamePasskey,
		passkeys,
		refreshPasskeys,
		renameTarget,
		totalPasskeys,
	} = usePasskeys();
	const {
		errorMessage: addErrorMessage,
		form: addForm,
		isSubmitting: isAddSubmitting,
		onSheetOpenChange: onAddSheetOpenChange,
		onSubmit: onAddSubmit,
		onFieldChange: onAddFieldChange,
	} = useAddPasskeyForm({
		onOpenChange: onAddOpenChange,
		onSuccess: refreshPasskeys,
	});

	function renderList() {
		if (loading) {
			return (
				<div className="text-muted-foreground flex justify-center py-3">
					<Spinner />
				</div>
			);
		}

		if (error) {
			return (
				<SectionLoadError
					isRetrying={isRefreshPending}
					message={error}
					onRetry={refreshPasskeys}
				/>
			);
		}

		if (totalPasskeys === 0 && !isPasskeySupported) {
			return null;
		}

		return (
			<ItemGroup aria-label="Passkeys" size="xl" variant="inset">
				{passkeys.map((entry) => (
					<Item asChild key={entry.id}>
						<button onClick={onSelectPasskey(entry)} type="button">
							<ItemMedia>
								<IconKey aria-hidden />
							</ItemMedia>
							<ItemContent>
								<ItemTitle>{entry.name || "Passkey"}</ItemTitle>
								<ItemDescription>
									{passkeyDescription(entry.createdAt, entry.backedUp)}
								</ItemDescription>
							</ItemContent>
							<ItemActions>
								<span className="inline-flex size-[var(--control-sm)] items-center justify-center">
									<IconDots aria-hidden className="size-3.5" />
								</span>
							</ItemActions>
						</button>
					</Item>
				))}
				{isPasskeySupported ? (
					<Item asChild>
						<button
							className="text-primary-text"
							onClick={onOpenAdd}
							type="button"
						>
							<ItemMedia>
								<IconPlus aria-hidden />
							</ItemMedia>
							<ItemContent>
								<ItemTitle>Add passkey</ItemTitle>
							</ItemContent>
						</button>
					</Item>
				) : null}
			</ItemGroup>
		);
	}

	return (
		<SettingsSection
			heading="Passkeys"
			note={
				isPasskeySupported
					? "Sign in with your face, fingerprint or screen lock instead of a password."
					: "This browser doesn't support passkeys. Use a recent version of Safari or Chrome to add one."
			}
		>
			{renderList()}

			<Drawer onOpenChange={onMenuOpenChange} open={menuTarget !== null}>
				<DrawerContent>
					<DrawerGrab />
					<DrawerHeader>
						<DrawerTitle>{menuTarget?.name || "Passkey"}</DrawerTitle>
						<DrawerDescription className="sr-only">
							Passkey actions
						</DrawerDescription>
					</DrawerHeader>
					<DrawerBody className="flex flex-col gap-2 pt-0.5">
						<ItemGroup aria-label="Passkey actions" size="xl" variant="inset">
							<Item asChild>
								<button onClick={onRenameFromMenu} type="button">
									<ItemMedia>
										<IconPencil aria-hidden />
									</ItemMedia>
									<ItemContent>
										<ItemTitle>Rename</ItemTitle>
									</ItemContent>
								</button>
							</Item>
						</ItemGroup>
						<ItemGroup aria-label="Danger" size="xl" variant="inset">
							<Item asChild variant="destructive">
								<button onClick={onRemoveFromMenu} type="button">
									<ItemMedia>
										<IconTrash aria-hidden />
									</ItemMedia>
									<ItemContent>
										<ItemTitle>Remove</ItemTitle>
									</ItemContent>
								</button>
							</Item>
						</ItemGroup>
						<Button
							className="w-full"
							onClick={onCloseMenu}
							size="xl"
							type="button"
							variant="secondary"
						>
							Cancel
						</Button>
					</DrawerBody>
				</DrawerContent>
			</Drawer>

			<FormSheet
				confirmLabel="Add"
				formId={ADD_PASSKEY_FORM_ID}
				isLoading={isAddSubmitting}
				isSaveDisabled={isAddSubmitting}
				onOpenChange={onAddSheetOpenChange}
				open={isAddOpen}
				title="Add passkey"
			>
				<AddPasskeyForm
					errorMessage={addErrorMessage}
					form={addForm}
					formId={ADD_PASSKEY_FORM_ID}
					onFieldChange={onAddFieldChange}
					onSubmit={onAddSubmit}
				/>
			</FormSheet>

			<FormSheet
				formId={RENAME_PASSKEY_FORM_ID}
				isLoading={isRenamePending}
				isSaveDisabled={isRenamePending}
				onOpenChange={onRenameOpenChange}
				open={renameTarget !== null}
				title="Rename passkey"
			>
				<TagNameForm
					defaultName={renameTarget?.name ?? ""}
					formId={RENAME_PASSKEY_FORM_ID}
					key={renameTarget?.id}
					label="Name"
					onSubmit={onRenamePasskey}
				/>
			</FormSheet>

			<Dialog onOpenChange={onDeleteOpenChange} open={deleteTarget !== null}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Remove passkey?</DialogTitle>
						<DialogDescription>
							{deleteTarget?.name || "This passkey"} will no longer sign you in.
							You can't undo this, and the passkey stays on the device until you
							delete it there.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button onClick={onCancelDelete} type="button" variant="outline">
							Cancel
						</Button>
						<Button
							aria-busy={isDeletePending}
							disabled={isDeletePending}
							onClick={onDeletePasskey}
							type="button"
							variant="destructive"
						>
							<IconTrash aria-hidden />
							Remove
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</SettingsSection>
	);
}
