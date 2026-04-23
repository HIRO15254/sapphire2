import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { useCreateCashGameSessionForm } from "./use-create-cash-game-session-form";

interface CreateCashGameSessionFormProps {
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

export function CreateCashGameSessionForm({
	currencies,
	isLoading,
	onStoreChange,
	onSubmit,
	ringGames,
	stores,
}: CreateCashGameSessionFormProps) {
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
							<SelectValue placeholder="Select a store" />
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
								<SelectValue placeholder="Select a ring game" />
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
							<SelectValue placeholder="Select a currency" />
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
