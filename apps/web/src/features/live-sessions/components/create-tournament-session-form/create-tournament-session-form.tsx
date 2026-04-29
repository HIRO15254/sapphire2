import { Button } from "@/shared/components/ui/button";
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
import { useCreateTournamentSessionForm } from "./use-create-tournament-session-form";

interface CreateTournamentSessionFormProps {
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

export function CreateTournamentSessionForm({
	currencies,
	isLoading,
	onStoreChange,
	onSubmit,
	stores,
	tournaments,
}: CreateTournamentSessionFormProps) {
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
