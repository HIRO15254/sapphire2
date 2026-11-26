import { IconListCheck, IconPlus } from "@tabler/icons-react";
import type {
	GameGroup,
	GameMix,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldError } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { firstError } from "@/shared/lib/form-errors";
import { GamesPicker } from "./games-picker";
import { type MixFormSubmit, useMixForm } from "./use-mix-form";

interface MixFormProps {
	formId: string;
	groups: GameGroup[] | undefined;
	mix: GameMix | null;
	mixes: GameMix[] | undefined;
	onSubmit: (values: MixFormSubmit) => Promise<void>;
	variants: GameVariant[];
}

const GAMES_ERROR_ID = "mix-games-error";

export function MixForm({
	formId,
	groups,
	mix,
	mixes,
	onSubmit,
	variants,
}: MixFormProps) {
	const {
		form,
		gamesError,
		isPickerOpen,
		labelError,
		onFormSubmit,
		onGamesChange,
		onLabelChange,
		onOpenPicker,
		onPickerOpenChange,
		summarize,
	} = useMixForm({ groups, mix, mixes, onSubmit, variants });

	return (
		<form
			className="flex flex-col gap-4 pt-1 pb-2"
			id={formId}
			noValidate
			onSubmit={onFormSubmit}
		>
			<form.Field name="label">
				{(field) => (
					<Field
						error={labelError ?? firstError(field.state.meta.errors)}
						htmlFor="mix-label"
						label="Name"
						required
					>
						<Input
							id="mix-label"
							onBlur={field.handleBlur}
							onChange={onLabelChange(field.handleChange)}
							size="xl"
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="games">
				{(field) => {
					const { buckets, countText, hasGames } = summarize(field.state.value);
					return (
						<section aria-label="Games" className="flex flex-col gap-1.5">
							<div className="flex items-baseline gap-2">
								<h3 className="text-muted-foreground m-0 flex-1 text-[11px] font-semibold tracking-[var(--tracking-caps)] uppercase">
									Games
									<span aria-hidden className="text-destructive-text ml-0.5">
										{"*"}
									</span>
								</h3>
								<span className="text-muted-foreground text-[length:var(--m-text-footnote)]">
									{countText}
								</span>
							</div>
							{hasGames ? (
								<div className="bg-card border-border flex flex-col gap-3 rounded-lg border p-3">
									{buckets.map((bucket) => (
										<div className="flex flex-col gap-1.5" key={bucket.groupId}>
											<div className="flex items-baseline gap-1.5">
												<span className="font-medium">{bucket.label}</span>
												<span className="text-muted-foreground font-mono text-xs">
													{bucket.count}
												</span>
											</div>
											<ul className="m-0 flex list-none flex-wrap gap-x-1.5 gap-y-0.5 p-0">
												{bucket.games.map((game, index) => (
													<li
														className={cn(
															"font-mono text-xs leading-[18px] whitespace-nowrap",
															game.archived && "text-muted-foreground"
														)}
														key={game.id}
													>
														{game.label}
														{index < bucket.games.length - 1 ? (
															<span
																aria-hidden
																className="text-muted-foreground ml-1.5"
															>
																·
															</span>
														) : null}
													</li>
												))}
											</ul>
										</div>
									))}
								</div>
							) : null}
							{gamesError ? (
								<FieldError id={GAMES_ERROR_ID}>{gamesError}</FieldError>
							) : null}
							<Button
								aria-describedby={gamesError ? GAMES_ERROR_ID : undefined}
								className="w-full"
								onClick={onOpenPicker}
								size="xl"
								type="button"
								variant="outline"
							>
								{hasGames ? (
									<IconListCheck aria-hidden />
								) : (
									<IconPlus aria-hidden />
								)}
								{hasGames ? "Choose games" : "Add games"}
							</Button>
							<GamesPicker
								groups={groups}
								onChange={onGamesChange(field.handleChange)}
								onOpenChange={onPickerOpenChange}
								open={isPickerOpen}
								value={field.state.value}
								variants={variants}
							/>
						</section>
					);
				}}
			</form.Field>
		</form>
	);
}
