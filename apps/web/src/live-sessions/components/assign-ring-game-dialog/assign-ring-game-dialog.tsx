import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { RingGameForm } from "@/stores/components/ring-game-form";
import { useAssignRingGame } from "./use-assign-ring-game";

interface AssignRingGameDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionId: string;
	sessionStoreId: string | null;
}

interface RingGameListItem {
	id: string;
	name: string;
}

function StoreSelectField({
	onChange,
	stores,
	value,
}: {
	onChange: (value: string) => void;
	stores: { id: string; name: string }[];
	value: string | undefined;
}) {
	if (stores.length === 0) {
		return (
			<Field className="mb-4" label="Store" required>
				<EmptyState
					className="px-4 py-8"
					description="Create a store first."
					heading="No stores available"
				/>
			</Field>
		);
	}
	return (
		<Field className="mb-4" label="Store" required>
			<Select onValueChange={onChange} value={value}>
				<SelectTrigger>
					<SelectValue placeholder="Select a store" />
				</SelectTrigger>
				<SelectContent>
					{stores.map((s) => (
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
	effectiveStoreId,
	onChange,
	ringGames,
	value,
}: {
	effectiveStoreId: string | undefined;
	onChange: (value: string) => void;
	ringGames: RingGameListItem[];
	value: string;
}) {
	if (!effectiveStoreId) {
		return (
			<Field label="Ring Game" required>
				<p className="text-muted-foreground text-sm">
					Please select a store first.
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
					<SelectValue placeholder="Select a ring game" />
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
	sessionStoreId,
}: AssignRingGameDialogProps) {
	const {
		mode,
		setMode,
		stores,
		selectedStoreId,
		setSelectedStoreId,
		effectiveStoreId,
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
		sessionStoreId,
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
						effectiveStoreId={effectiveStoreId}
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
							!effectiveStoreId ||
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
		if (!effectiveStoreId) {
			return (
				<p className="text-muted-foreground text-sm">
					Please select a store first.
				</p>
			);
		}
		return <RingGameForm isLoading={isCreatePending} onSubmit={handleCreate} />;
	};

	return (
		<ResponsiveDialog
			fullHeight={mode === "create"}
			onOpenChange={(o) => {
				if (!isBusy) {
					onOpenChange(o);
				}
			}}
			open={open}
			title="Assign Ring Game"
		>
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

			{sessionStoreId ? null : (
				<StoreSelectField
					onChange={(value) => setSelectedStoreId(value)}
					stores={stores}
					value={selectedStoreId}
				/>
			)}

			{mode === "existing" ? renderExistingTab() : renderCreateTab()}
		</ResponsiveDialog>
	);
}
