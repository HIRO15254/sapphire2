import { RingGameForm } from "@/features/rooms/components/ring-game-form";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/shared/components/bottom-sheet";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { useAssignRingGame } from "./use-assign-ring-game";

const CREATE_RING_GAME_FORM_ID = "assign-ring-game-create-form";

interface AssignRingGameDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionRoomId: string | null;
}

interface RingGameListItem {
	id: string;
	name: string;
}

type AssignRingGameMode = "existing" | "create";

const TAB_BUTTON_CLASS = "h-[34px] flex-1 rounded-[var(--radius-md)] text-sm";
const TAB_ACTIVE_CLASS = "bg-card font-semibold text-foreground";
const TAB_INACTIVE_CLASS = "font-medium text-muted-foreground";

function ModeTabs({
	mode,
	onChange,
}: {
	mode: AssignRingGameMode;
	onChange: (mode: AssignRingGameMode) => void;
}) {
	return (
		<div className="mb-4 flex gap-0.5 rounded-[var(--radius-lg)] bg-muted p-[3px]">
			<button
				aria-pressed={mode === "existing"}
				className={cn(
					TAB_BUTTON_CLASS,
					mode === "existing" ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS
				)}
				onClick={() => onChange("existing")}
				type="button"
			>
				Select existing
			</button>
			<button
				aria-pressed={mode === "create"}
				className={cn(
					TAB_BUTTON_CLASS,
					mode === "create" ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS
				)}
				onClick={() => onChange("create")}
				type="button"
			>
				Create new
			</button>
		</div>
	);
}

function RoomSelectField({
	onChange,
	rooms,
	value,
}: {
	onChange: (value: string) => void;
	rooms: { id: string; name: string }[];
	value: string | undefined;
}) {
	if (rooms.length === 0) {
		return (
			<Field className="mb-4" label="Room" required>
				<EmptyState
					className="px-4 py-8"
					description="Create a room first."
					heading="No rooms available"
				/>
			</Field>
		);
	}
	return (
		<Field className="mb-4" label="Room" required>
			<Select onValueChange={onChange} value={value}>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{rooms.map((s) => (
						<SelectItem key={s.id} value={s.id}>
							{s.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

function RingGamePickerField({
	effectiveRoomId,
	onChange,
	ringGames,
	value,
}: {
	effectiveRoomId: string | undefined;
	onChange: (value: string) => void;
	ringGames: RingGameListItem[];
	value: string;
}) {
	if (!effectiveRoomId) {
		return (
			<Field label="Ring Game" required>
				<p className="text-muted-foreground text-sm">
					Please select a room first.
				</p>
			</Field>
		);
	}
	if (ringGames.length === 0) {
		return (
			<Field label="Ring Game" required>
				<EmptyState
					className="px-4 py-8"
					description="Use the Create new tab to add one."
					heading="No ring games"
				/>
			</Field>
		);
	}
	return (
		<Field label="Ring Game" required>
			<Select onValueChange={onChange} value={value}>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{ringGames.map((g) => (
						<SelectItem key={g.id} value={g.id}>
							{g.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

export function AssignRingGameDialog({
	onOpenChange,
	open,
	sessionId,
	sessionRoomId,
}: AssignRingGameDialogProps) {
	const {
		mode,
		setMode,
		rooms,
		selectedRoomId,
		setSelectedRoomId,
		effectiveRoomId,
		ringGames,
		selectForm,
		handleCreate,
		isAssignPending,
		isCreatePending,
		isBusy,
	} = useAssignRingGame({
		onClose: () => onOpenChange(false),
		open,
		sessionId,
		sessionRoomId,
	});

	const handleOpenChange = (nextOpen: boolean) => {
		if (!isBusy) {
			onOpenChange(nextOpen);
		}
	};

	const renderExistingTab = () => (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				selectForm.handleSubmit();
			}}
		>
			<selectForm.Field name="ringGameId">
				{(field) => (
					<RingGamePickerField
						effectiveRoomId={effectiveRoomId}
						onChange={(value) => field.handleChange(value)}
						ringGames={ringGames}
						value={field.state.value}
					/>
				)}
			</selectForm.Field>

			<selectForm.Subscribe>
				{(state) => (
					<Button
						disabled={
							isBusy ||
							!effectiveRoomId ||
							!state.values.ringGameId ||
							state.isSubmitting
						}
						type="submit"
					>
						{isAssignPending ? "Assigning..." : "Assign"}
					</Button>
				)}
			</selectForm.Subscribe>
		</form>
	);

	const renderCreateTab = () => {
		if (!effectiveRoomId) {
			return (
				<p className="text-muted-foreground text-sm">
					Please select a room first.
				</p>
			);
		}
		return (
			<div className="flex flex-col gap-4">
				<RingGameForm
					formId={CREATE_RING_GAME_FORM_ID}
					onSubmit={handleCreate}
				/>
				<Button disabled={isBusy} form={CREATE_RING_GAME_FORM_ID} type="submit">
					{isCreatePending ? "Saving..." : "Save"}
				</Button>
			</div>
		);
	};

	return (
		<BottomSheet
			cancelLabel="Cancel"
			description="Select an existing ring game or create a new one for this session."
			onOpenChange={handleOpenChange}
			open={open}
			title="Assign Ring Game"
		>
			<ModeTabs mode={mode} onChange={setMode} />

			{sessionRoomId ? null : (
				<RoomSelectField
					onChange={(value) => setSelectedRoomId(value)}
					rooms={rooms}
					value={selectedRoomId}
				/>
			)}

			{mode === "existing" ? renderExistingTab() : renderCreateTab()}
		</BottomSheet>
	);
}
