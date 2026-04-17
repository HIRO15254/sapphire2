import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import z from "zod";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";

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
		storeId: string;
		tournamentId: string;
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

const createTournamentSessionFormSchema = z.object({
	buyIn: z.coerce
		.number({ invalid_type_error: "Buy-in is required" })
		.min(0, "Must be 0 or greater"),
	entryFee: z.coerce.number().min(0, "Must be 0 or greater").optional(),
	startingStack: z.coerce
		.number({ invalid_type_error: "Starting stack is required" })
		.min(0, "Must be 0 or greater"),
	memo: z.string().optional(),
});

export function CreateTournamentSessionForm({
	currencies,
	isLoading,
	onStoreChange,
	onSubmit,
	stores,
	tournaments,
}: CreateTournamentSessionFormProps) {
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		undefined
	);
	const [selectedTournamentId, setSelectedTournamentId] = useState<
		string | undefined
	>(undefined);
	const [selectedCurrencyId, setSelectedCurrencyId] = useState<
		string | undefined
	>(undefined);

	const selectedTournament = selectedTournamentId
		? tournaments.find((t) => t.id === selectedTournamentId)
		: null;

	const isBuyInLocked =
		selectedTournament?.buyIn !== null &&
		selectedTournament?.buyIn !== undefined;
	const isEntryFeeLocked =
		selectedTournament?.entryFee !== null &&
		selectedTournament?.entryFee !== undefined;
	const isStartingStackLocked =
		selectedTournament?.startingStack !== null &&
		selectedTournament?.startingStack !== undefined;
	const isCurrencyLocked =
		selectedTournament?.currencyId !== null &&
		selectedTournament?.currencyId !== undefined;

	const form = useForm({
		defaultValues: {
			buyIn: undefined as number | undefined,
			entryFee: undefined as number | undefined,
			startingStack: undefined as number | undefined,
			memo: "",
		},
		onSubmit: ({ value }) => {
			if (!(selectedStoreId && selectedTournamentId)) {
				return;
			}
			onSubmit({
				storeId: selectedStoreId,
				tournamentId: selectedTournamentId,
				currencyId: selectedCurrencyId,
				buyIn: value.buyIn as number,
				entryFee: value.entryFee,
				startingStack: value.startingStack as number,
				memo: value.memo || undefined,
			});
		},
		validators: {
			onSubmit: createTournamentSessionFormSchema,
		},
	});

	const handleStoreChange = (value: string) => {
		setSelectedStoreId(value);
		setSelectedTournamentId(undefined);
		onStoreChange?.(value);
	};

	const applyTournamentDefaults = (t: (typeof tournaments)[number]) => {
		if (t.currencyId) {
			setSelectedCurrencyId(t.currencyId);
		}
		form.setFieldValue("buyIn", t.buyIn ?? undefined);
		form.setFieldValue("entryFee", t.entryFee ?? undefined);
		form.setFieldValue("startingStack", t.startingStack ?? undefined);
	};

	const handleTournamentChange = (value: string) => {
		setSelectedTournamentId(value);
		const t = tournaments.find((t) => t.id === value);
		if (t) {
			applyTournamentDefaults(t);
		}
	};

	const handleCurrencyChange = (value: string) => {
		setSelectedCurrencyId(value);
	};

	const hasTournaments = tournaments.length > 0;
	const canSubmit = !!selectedStoreId && !!selectedTournamentId;

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<Field label="Store" required>
				{stores.length > 0 ? (
					<Select onValueChange={handleStoreChange} value={selectedStoreId}>
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
					</Select>
				) : (
					<EmptyState
						className="px-4 py-8"
						description="Create a store first."
						heading="No stores available"
					/>
				)}
			</Field>

			{selectedStoreId && (
				<Field label="Tournament" required>
					{hasTournaments ? (
						<Select
							onValueChange={handleTournamentChange}
							value={selectedTournamentId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a tournament" />
							</SelectTrigger>
							<SelectContent>
								{tournaments.map((t) => (
									<SelectItem key={t.id} value={t.id}>
										{t.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<EmptyState
							className="px-4 py-8"
							description="Create one in store settings."
							heading="No tournaments available"
						/>
					)}
				</Field>
			)}

			{selectedTournamentId && (
				<>
					{currencies.length > 0 && (
						<Field label="Currency">
							<Select
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
							</Select>
						</Field>
					)}

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
										min={0}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(
												e.target.value === "" ? undefined : Number(e.target.value)
											)
										}
										type="number"
										value={field.state.value !== undefined ? String(field.state.value) : ""}
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
										min={0}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(
												e.target.value === "" ? undefined : Number(e.target.value)
											)
										}
										type="number"
										value={field.state.value !== undefined ? String(field.state.value) : ""}
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
									min={0}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(
											e.target.value === "" ? undefined : Number(e.target.value)
										)
									}
									type="number"
									value={field.state.value !== undefined ? String(field.state.value) : ""}
								/>
							</Field>
						)}
					</form.Field>

					<form.Field name="memo">
						{(field) => (
							<Field htmlFor={field.name} label="Memo">
								<Textarea
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Notes about this tournament"
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
				</>
			)}

			<form.Subscribe>
				{(state) => (
					<Button
						className="mt-2"
						disabled={
							isLoading || !canSubmit || !state.canSubmit || state.isSubmitting
						}
						type="submit"
					>
						{isLoading || state.isSubmitting ? "Starting..." : "Start Tournament"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
