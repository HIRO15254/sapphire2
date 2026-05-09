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
import { GameRuleSection } from "../game-rule-section";
import { StoreGameSelectors } from "../link-selectors";
import { ResultSection } from "../result-section";
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

export type SessionFormMode =
	| "manual"
	| "live-active"
	| "live-completed"
	| "live-discarded";

interface LiveSessionData {
	blindLevels?: Array<{
		id: number;
		levelIndex: number;
		isBreak: boolean;
		minutes?: number | null;
		sortOrder: number;
		blindSets: Array<{
			id: number;
			limitFormatId: number;
			blind1: number;
			blind2: number;
			blind3?: number | null;
			blind4?: number | null;
			ante?: number | null;
			anteType?: "none" | "all" | "bb" | null;
			sortOrder: number;
		}>;
	}>;
	cashBlindSets?: Array<{
		id: number;
		limitFormatId: number;
		blind1: number;
		blind2: number;
		blind3?: number | null;
		blind4?: number | null;
		ante?: number | null;
		anteType?: "none" | "all" | "bb" | null;
		sortOrder: number;
	}>;
	cashDetail?: {
		buyIn?: number | null;
		cashOut?: number | null;
		evCashOut?: number | null;
		ruleName?: string | null;
		minBuyIn?: number | null;
		maxBuyIn?: number | null;
		tableSize?: number | null;
	} | null;
	chipPurchaseOptions?: Array<{
		id: number;
		name: string;
		cost: number;
		chips: number;
		sortOrder: number;
	}>;
	liveSessionId: string;
	tournamentDetail?: {
		beforeDeadline?: boolean | null;
		bountyAmount?: number | null;
		bountyPrizes?: number | null;
		buyIn?: number | null;
		entryFee?: number | null;
		placement?: number | null;
		prizeMoney?: number | null;
		ruleName?: string | null;
		startingStack?: number | null;
		tableSize?: number | null;
		totalEntries?: number | null;
	} | null;
}

interface SessionFormProps {
	currencies?: Array<{ id: string; name: string }>;
	defaultValues?: SessionFormDefaults;
	/** @deprecated use `mode` instead */
	isLiveLinked?: boolean;
	isLoading?: boolean;
	liveData?: LiveSessionData;
	mode?: SessionFormMode;
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
	liveData,
	mode = "manual",
	onCreateTag,
	onStoreChange,
	onSubmit,
	ringGames,
	stores,
	tags,
	tournaments,
}: SessionFormProps) {
	// Derive effective read-only state from mode
	const isReadOnly = mode === "live-discarded";
	// For backward compat: treat isLiveLinked as live-active if no explicit mode
	const effectiveIsLiveLinked = isLiveLinked || mode !== "manual";
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
			isLiveLinked={effectiveIsLiveLinked}
			onCurrencyChange={setSelectedCurrencyId}
			selectedCurrencyId={selectedCurrencyId}
		/>
	) : (
		<TournamentDetailFields
			currencies={currencies}
			form={form}
			isLiveLinked={effectiveIsLiveLinked}
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

	// For live modes, render a simplified view with rule/result sections
	if (
		mode === "live-active" ||
		mode === "live-completed" ||
		mode === "live-discarded"
	) {
		const liveReadOnly = mode === "live-discarded";
		const liveSessionId = liveData?.liveSessionId ?? "";
		const kind = isCashGame ? "cash_game" : "tournament";

		return (
			<div className="flex flex-col gap-4">
				{mode === "live-discarded" && (
					<Alert data-testid="discarded-banner">
						<AlertDescription>
							This session was discarded. All data is read-only.
						</AlertDescription>
					</Alert>
				)}
				{mode === "live-completed" && (
					<Alert data-testid="completed-banner">
						<AlertDescription>
							Session completed. You can still edit the rule snapshot and
							events.
						</AlertDescription>
					</Alert>
				)}

				<div className="flex flex-col gap-1">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Result
					</p>
					<ResultSection
						cashResult={liveData?.cashDetail}
						kind={kind}
						tournamentResult={liveData?.tournamentDetail}
					/>
				</div>

				{liveSessionId && (
					<div className="flex flex-col gap-1">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Game Rules
						</p>
						<GameRuleSection
							blindLevels={liveData?.blindLevels}
							cashBlindSets={liveData?.cashBlindSets}
							cashDetail={liveData?.cashDetail}
							chipPurchaseOptions={liveData?.chipPurchaseOptions}
							isLive
							isReadOnly={liveReadOnly}
							kind={kind}
							sessionId={liveSessionId}
							tournamentDetail={liveData?.tournamentDetail}
						/>
					</div>
				)}
			</div>
		);
	}

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			{effectiveIsLiveLinked && (
				<Alert data-testid="live-linked-banner">
					<AlertDescription>
						This session is generated from a live session. Items calculated from
						event history cannot be edited. To modify, edit the events in the
						live session.
					</AlertDescription>
				</Alert>
			)}
			<Field label="Session Type">
				<Tabs
					onValueChange={(value) =>
						setSessionType(value as "cash_game" | "tournament")
					}
					value={sessionType}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger disabled={effectiveIsLiveLinked} value="cash_game">
							Cash Game
						</TabsTrigger>
						<TabsTrigger disabled={effectiveIsLiveLinked} value="tournament">
							Tournament
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</Field>

			<div className="flex flex-col gap-4">
				<form.Field name="sessionDate">
					{(field) => (
						<Field htmlFor={field.name} label="Session Date" required>
							<Input
								disabled={effectiveIsLiveLinked}
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
									disabled={effectiveIsLiveLinked}
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
									disabled={effectiveIsLiveLinked}
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
								disabled={effectiveIsLiveLinked}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>

				<StoreGameSelectors
					gameLabel={gameLabel}
					gameOptions={gameOptions}
					isLiveLinked={effectiveIsLiveLinked}
					onGameChange={handleGameChange}
					onStoreChange={handleStoreChange}
					selectedGameId={selectedGameId}
					selectedStoreId={selectedStoreId}
					stores={stores}
				/>

				{isCashGame && (
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
											disabled={effectiveIsLiveLinked}
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
											disabled={effectiveIsLiveLinked}
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
										disabled={effectiveIsLiveLinked}
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

				{!isCashGame && (
					<TournamentPrimaryFields
						form={form}
						isLiveLinked={effectiveIsLiveLinked}
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

			{!isReadOnly && (
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
			)}
		</form>
	);
}
