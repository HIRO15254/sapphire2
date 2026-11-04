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
}: {
	errorMessage: string | null;
	form: ReturnType<typeof useAddPasskeyForm>["form"];
	formId: string;
}) {
	return (
		<form
			className="flex flex-col gap-4 pt-1 pb-2"
			id={formId}
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			{errorMessage ? (
				<Alert variant="destructive">
					<AlertTitle>Couldn't add the passkey</AlertTitle>
					<AlertDescription>{errorMessage}</AlertDescription>
				</Alert>
			) : null}
			<p className="m-0 text-muted-foreground leading-normal">
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
							onChange={(event) => field.handleChange(event.target.value)}
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
		onDeletePasskey,
		onDeleteTargetChange,
		onMenuTargetChange,
		onRemoveFromMenu,
		onRenameFromMenu,
		onRenamePasskey,
		onRenameTargetChange,
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
	} = useAddPasskeyForm({
		onOpenChange: onAddOpenChange,
		onSuccess: refreshPasskeys,
	});

	function renderList() {
		if (loading) {
			return (
				<div className="flex justify-center py-3 text-muted-foreground">
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
						<button onClick={() => onMenuTargetChange(entry)} type="button">
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
							onClick={() => onAddOpenChange(true)}
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

			<Drawer
				onOpenChange={(open) => {
					if (!open) {
						onMenuTargetChange(null);
					}
				}}
				open={menuTarget !== null}
			>
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
							onClick={() => onMenuTargetChange(null)}
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
				/>
			</FormSheet>

			<FormSheet
				formId={RENAME_PASSKEY_FORM_ID}
				isLoading={isRenamePending}
				isSaveDisabled={isRenamePending}
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
					label="Name"
					onSubmit={onRenamePasskey}
				/>
			</FormSheet>

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						onDeleteTargetChange(null);
					}
				}}
				open={deleteTarget !== null}
			>
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
						<Button
							onClick={() => onDeleteTargetChange(null)}
							type="button"
							variant="outline"
						>
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
