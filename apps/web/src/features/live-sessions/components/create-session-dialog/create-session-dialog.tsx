import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";
import { useCreateCashGameSessionForm } from "./use-create-cash-game-session-form";
import { useCreateSessionDialog } from "./use-create-session-dialog";
import { useCreateTournamentSessionForm } from "./use-create-tournament-session-form";

interface CreateSessionDialogProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

interface CashGameSubFormProps {
	currencies: Array<{ id: string; name: string }>;
	isLoading: boolean;
	onStoreChange?: (storeId?: string) => void;
	onSubmit: (values: {
		currencyId?: string;
		initialBuyIn: number;
		memo?: string;
		ringGameId?: string;
		storeId?: string;
	}) => void;
	ringGames: Array<{
		id: string;
		name: string;
		minBuyIn: number | null;
		maxBuyIn: number | null;
		currencyId: string | null;
	}>;
	stores: Array<{ id: string; name: string }>;
}

function CashGameSubForm({
	currencies,
	isLoading,
	onStoreChange,
	onSubmit,
	ringGames,
	stores,
}: CashGameSubFormProps) {
	const {
		form,
		selectedStoreId,
		selectedRingGameId,
		selectedRingGame,
		selectedCurrencyId,
		isCurrencyLocked,
		handleStoreChange,
		handleRingGameChange,
		handleCurrencyChange,
	} = useCreateCashGameSessionForm({ onStoreChange, onSubmit, ringGames });

	const hasRingGames = ringGames.length > 0;

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<Field label="Store">
				{stores.length > 0 ? (
					<SelectWithClear
						onValueChange={handleStoreChange}
						value={selectedStoreId}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{stores.map((store) => (
								<SelectItem key={store.id} value={store.id}>
									{store.name}
								</SelectItem>
							))}
						</SelectContent>
					</SelectWithClear>
				) : (
					<p className="text-muted-foreground text-xs">
						No stores yet. You can start without one.
					</p>
				)}
			</Field>

			{selectedStoreId ? (
				<Field label="Ring Game">
					{hasRingGames ? (
						<SelectWithClear
							onValueChange={handleRingGameChange}
							value={selectedRingGameId}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ringGames.map((game) => (
									<SelectItem key={game.id} value={game.id}>
										{game.name}
									</SelectItem>
								))}
							</SelectContent>
						</SelectWithClear>
					) : (
						<EmptyState
							className="px-4 py-8"
							description="You can create and assign one later from the active session."
							heading="No ring games available"
						/>
					)}
				</Field>
			) : null}

			{currencies.length > 0 ? (
				<Field label="Currency" required>
					<SelectWithClear
						disabled={isCurrencyLocked}
						onValueChange={handleCurrencyChange}
						value={selectedCurrencyId}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{currencies.map((currency) => (
								<SelectItem key={currency.id} value={currency.id}>
									{currency.name}
								</SelectItem>
							))}
						</SelectContent>
					</SelectWithClear>
				</Field>
			) : null}

			<form.Field
				name="initialBuyIn"
				validators={{
					onChange: ({ value }) => {
						if (value === "") {
							return "Buy-in is required";
						}
						const numValue = Number(value);
						if (!Number.isFinite(numValue)) {
							return "Must be a number";
						}
						if (numValue < 0) {
							return "Must be 0 or greater";
						}
						if (
							selectedRingGame?.minBuyIn != null &&
							numValue < selectedRingGame.minBuyIn
						) {
							return `Must be at least ${selectedRingGame.minBuyIn}`;
						}
						if (
							selectedRingGame?.maxBuyIn != null &&
							numValue > selectedRingGame.maxBuyIn
						) {
							return `Must be at most ${selectedRingGame.maxBuyIn}`;
						}
						return;
					},
				}}
			>
				{(field) => (
					<Field
						error={field.state.meta.errors[0]}
						htmlFor={field.name}
						label="Initial Buy-in"
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

			<form.Field name="memo">
				{(field) => (
					<Field htmlFor={field.name} label="Memo">
						<Textarea
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Subscribe>
				{(state) => (
					<Button
						className="mt-2"
						disabled={isLoading || !state.canSubmit || state.isSubmitting}
						type="submit"
					>
						{isLoading ? "Starting..." : "Start Session"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}

interface TournamentSubFormProps {
	currencies: Array<{ id: string; name: string }>;
	isLoading: boolean;
	onStoreChange?: (storeId?: string) => void;
	onSubmit: (values: {
		buyIn: number;
		currencyId?: string;
		entryFee?: number;
		memo?: string;
		startingStack: number;
		storeId?: string;
		timerStartedAt?: number;
		tournamentId?: string;
	}) => void;
	stores: Array<{ id: string; name: string }>;
	tournaments: Array<{
		id: string;
		name: string;
		buyIn: number | null;
		entryFee: number | null;
		startingStack: number | null;
		currencyId: string | null;
	}>;
}

function TournamentSubForm({
	currencies,
	isLoading,
	onStoreChange,
	onSubmit,
	stores,
	tournaments,
}: TournamentSubFormProps) {
	const {
		form,
		selectedStoreId,
		selectedTournamentId,
		selectedCurrencyId,
		isBuyInLocked,
		isEntryFeeLocked,
		isStartingStackLocked,
		isCurrencyLocked,
		handleStoreChange,
		handleTournamentChange,
		handleCurrencyChange,
	} = useCreateTournamentSessionForm({ onStoreChange, onSubmit, tournaments });

	const hasTournaments = tournaments.length > 0;

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<Field label="Store">
				{stores.length > 0 ? (
					<SelectWithClear
						onValueChange={handleStoreChange}
						value={selectedStoreId}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{stores.map((store) => (
								<SelectItem key={store.id} value={store.id}>
									{store.name}
								</SelectItem>
							))}
						</SelectContent>
					</SelectWithClear>
				) : (
					<p className="text-muted-foreground text-xs">
						No stores yet. You can start without one.
					</p>
				)}
			</Field>

			{selectedStoreId ? (
				<Field label="Tournament">
					{hasTournaments ? (
						<SelectWithClear
							onValueChange={handleTournamentChange}
							value={selectedTournamentId}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{tournaments.map((t) => (
									<SelectItem key={t.id} value={t.id}>
										{t.name}
									</SelectItem>
								))}
							</SelectContent>
						</SelectWithClear>
					) : (
						<p className="text-muted-foreground text-xs">
							You can create and assign one later from the active session.
						</p>
					)}
				</Field>
			) : null}

			{currencies.length > 0 ? (
				<Field label="Currency" required>
					<SelectWithClear
						disabled={isCurrencyLocked}
						onValueChange={handleCurrencyChange}
						value={selectedCurrencyId}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{currencies.map((currency) => (
								<SelectItem key={currency.id} value={currency.id}>
									{currency.name}
								</SelectItem>
							))}
						</SelectContent>
					</SelectWithClear>
				</Field>
			) : null}

			<div className="flex gap-3">
				<form.Field name="buyIn">
					{(field) => (
						<Field
							className="flex-1"
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Buy-in"
							required
						>
							<Input
								disabled={isBuyInLocked}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="entryFee">
					{(field) => (
						<Field
							className="flex-1"
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Entry Fee"
						>
							<Input
								disabled={isEntryFeeLocked}
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

			<form.Field name="startingStack">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Starting Stack"
						required
					>
						<Input
							disabled={isStartingStackLocked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="timerStartedAt">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Timer Start Time"
					>
						<Input
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							step={60}
							type="datetime-local"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="memo">
				{(field) => (
					<Field htmlFor={field.name} label="Memo">
						<Textarea
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Subscribe>
				{(state) => (
					<Button
						className="mt-2"
						disabled={isLoading || !state.canSubmit || state.isSubmitting}
						type="submit"
					>
						{isLoading ? "Starting..." : "Start Tournament"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}

export function CreateSessionDialog({
	open,
	onOpenChange,
}: CreateSessionDialogProps) {
	const {
		sessionType,
		setSessionType,
		stores,
		currencies,
		ringGames,
		tournaments,
		setSelectedStoreId,
		createCash,
		createTournament,
		isLoading,
		handleReset,
	} = useCreateSessionDialog({ onOpenChange });

	return (
		<ResponsiveDialog
			onOpenChange={(o) => {
				onOpenChange(o);
				if (!o) {
					handleReset();
				}
			}}
			open={open}
			title="New Session"
		>
			{/* Session type selector */}
			<Tabs
				className="mb-4"
				onValueChange={(value) =>
					setSessionType(value as "cash_game" | "tournament")
				}
				value={sessionType}
			>
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="cash_game">Cash Game</TabsTrigger>
					<TabsTrigger value="tournament">Tournament</TabsTrigger>
				</TabsList>
			</Tabs>

			{sessionType === "cash_game" ? (
				<CashGameSubForm
					currencies={currencies}
					isLoading={isLoading}
					onStoreChange={setSelectedStoreId}
					onSubmit={(values) => createCash(values)}
					ringGames={ringGames}
					stores={stores}
				/>
			) : (
				<TournamentSubForm
					currencies={currencies}
					isLoading={isLoading}
					onStoreChange={setSelectedStoreId}
					onSubmit={(values) => createTournament(values)}
					stores={stores}
					tournaments={tournaments}
				/>
			)}
		</ResponsiveDialog>
	);
}
