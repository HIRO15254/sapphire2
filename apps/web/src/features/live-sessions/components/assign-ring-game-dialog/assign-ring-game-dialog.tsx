import { RingGameForm } from "@/features/rooms/components/ring-game-form";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
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
		<Drawer
			onOpenChange={(o) => {
				if (!isBusy) {
					onOpenChange(o);
				}
			}}
			open={open}
		>
			<DrawerContent className="rounded-t-xl">
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<DrawerTitle className="t-h4 px-4 pt-1">Assign Ring Game</DrawerTitle>
				<DrawerDescription className="sr-only">
					Select an existing ring game or create a new one for this session.
				</DrawerDescription>
				<div className="overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					<Tabs
						className="mb-4"
						onValueChange={(value) => setMode(value as "existing" | "create")}
						value={mode}
					>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="existing">Select existing</TabsTrigger>
							<TabsTrigger value="create">Create new</TabsTrigger>
						</TabsList>
					</Tabs>

					{sessionRoomId ? null : (
						<RoomSelectField
							onChange={(value) => setSelectedRoomId(value)}
							rooms={rooms}
							value={selectedRoomId}
						/>
					)}

					{mode === "existing" ? renderExistingTab() : renderCreateTab()}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
