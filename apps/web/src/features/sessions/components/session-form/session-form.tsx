import type {
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { TagInput } from "@/shared/components/ui/tag-input";
import { Textarea } from "@/shared/components/ui/textarea";
import { CashGameFields } from "../cash-game-fields";
import { FormAccordion } from "../form-section";
import { StoreGameSelectors } from "../link-selectors";
import {
	TournamentDetailFields,
	TournamentPrimaryFields,
} from "../tournament-fields";
import { useSessionFormState } from "./use-session-form-state";

export type {
	CashGameFormValues,
	RingGameOption,
	SessionFormDefaults,
	SessionFormValues,
	TournamentFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";

interface SessionFormProps {
	currencies?: Array<{ id: string; name: string }>;
	defaultValues?: SessionFormDefaults;
	isLiveLinked?: boolean;
	isLoading?: boolean;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	onStoreChange?: (storeId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	stores?: Array<{ id: string; name: string }>;
	tags?: Array<{ id: string; name: string }>;
	tournaments?: TournamentOption[];
}

export function SessionForm({
	currencies,
	defaultValues,
	isLiveLinked = false,
	isLoading = false,
	onCreateTag,
	onStoreChange,
	onSubmit,
	ringGames,
	stores,
	tags,
	tournaments,
}: SessionFormProps) {
	const {
		form,
		sessionType,
		setSessionType,
		selectedTagIds,
		setSelectedTagIds,
		selectedStoreId,
		selectedGameId,
		selectedCurrencyId,
		setSelectedCurrencyId,
		handleStoreChange,
		handleGameChange,
		gameOptions,
		gameLabel,
		isCashGame,
	} = useSessionFormState({
		defaultValues,
		onStoreChange,
		onSubmit,
		ringGames,
		tournaments,
	});

	const detailContent = isCashGame ? (
		<CashGameFields
			currencies={currencies}
			form={form}
			isLiveLinked={isLiveLinked}
			onCurrencyChange={setSelectedCurrencyId}
			selectedCurrencyId={selectedCurrencyId}
		/>
	) : (
		<TournamentDetailFields
			currencies={currencies}
			form={form}
			isLiveLinked={isLiveLinked}
			onCurrencyChange={setSelectedCurrencyId}
			selectedCurrencyId={selectedCurrencyId}
		/>
	);

	const tagsContent = (
		<>
			<Field label="Session Tags">
				<TagInput
					availableTags={tags}
					onAdd={(tag) => setSelectedTagIds((prev) => [...prev, tag.id])}
					onCreateTag={onCreateTag}
					onRemove={(tag) =>
						setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id))
					}
					selectedTags={selectedTagIds
						.map((id) => tags?.find((t) => t.id === id))
						.filter((t): t is { id: string; name: string } => t !== undefined)}
				/>
			</Field>
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
		</>
	);

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			{isLiveLinked && (
				<Alert data-testid="live-linked-banner">
					<AlertDescription>
						This session was generated from a live session. Fields derived from
						event history — timing, buy-ins, payouts, placement, chip purchases,
						and blinds — are managed there and are not shown here. Edit the
						events in the live session to update them. Store, currency, tags,
						and memo can still be edited below.
					</AlertDescription>
				</Alert>
			)}
			{!isLiveLinked && (
				<Field label="Session Type">
					<Tabs
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
				</Field>
			)}

			<div className="flex flex-col gap-4">
				{!isLiveLinked && (
					<>
						<form.Field name="sessionDate">
							{(field) => (
								<Field htmlFor={field.name} label="Session Date" required>
									<Input
										id={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										type="date"
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>

						<div className="grid grid-cols-2 gap-3">
							<form.Field name="startTime">
								{(field) => (
									<Field htmlFor={field.name} label="Start Time">
										<Input
											id={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											type="time"
											value={field.state.value}
										/>
									</Field>
								)}
							</form.Field>
							<form.Field name="endTime">
								{(field) => (
									<Field htmlFor={field.name} label="End Time">
										<Input
											id={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											type="time"
											value={field.state.value}
										/>
									</Field>
								)}
							</form.Field>
						</div>

						<form.Field name="breakMinutes">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label="Break Time (min)"
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
					</>
				)}

				<StoreGameSelectors
					gameLabel={gameLabel}
					gameOptions={gameOptions}
					isLiveLinked={isLiveLinked}
					onGameChange={handleGameChange}
					onStoreChange={handleStoreChange}
					selectedGameId={selectedGameId}
					selectedStoreId={selectedStoreId}
					stores={stores}
				/>

				{!isLiveLinked && isCashGame && (
					<>
						<div className="grid grid-cols-2 gap-3">
							<form.Field name="buyIn">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={field.name}
										label="Buy-in"
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
							<form.Field name="cashOut">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={field.name}
										label="Cash-out"
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
						</div>
						<form.Field name="evCashOut">
							{(field) => (
								<Field htmlFor={field.name} label="EV Cash-out">
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
					</>
				)}

				{!(isLiveLinked || isCashGame) && (
					<TournamentPrimaryFields
						form={form}
						key={`tourney-primary-${selectedGameId ?? "none"}`}
					/>
				)}
			</div>

			<FormAccordion
				items={[
					{
						value: "detail",
						title: isCashGame ? "Detail" : "Tournament Details",
						children: detailContent,
					},
					{
						value: "tags",
						title: "Tags & Memo",
						children: tagsContent,
					},
				]}
			/>

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, isSubmitting]) => (
					<Button
						className="mt-2"
						disabled={isLoading || !canSubmit || isSubmitting}
						type="submit"
					>
						{isLoading ? "Saving..." : "Save"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
