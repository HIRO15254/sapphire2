import { IconX } from "@tabler/icons-react";
import { FormSheet } from "@/shared/components/form-sheet";
import { Badge } from "@/shared/components/ui/badge";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { VariantSelect } from "@/shared/components/variant-select";
import type { GameMixRow, GameVariantRow } from "../use-game-library-section";
import { useMixFormSheet } from "./use-mix-form-sheet";

const MIX_FORM_ID = "game-mix-form";

export interface MixFormSheetProps {
	editingMix: GameMixRow | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	variants: GameVariantRow[];
}

/**
 * Create AND edit share this sheet — see `use-mix-form-sheet.ts` for the
 * mode derivation and the label<->id mapping contract. The UI works in
 * variant LABELS (Badge chips + `VariantSelect`, which is itself
 * label-based); the hook converts to/from ordered variant IDs for the
 * gameMix.create/update payload.
 */
export function MixFormSheet({
	editingMix,
	onOpenChange,
	open,
	variants,
}: MixFormSheetProps) {
	const {
		form,
		formTitle,
		isPending,
		onAddGame,
		onOpenChange: handleOpenChange,
		onRemoveGame,
		selectedGames,
	} = useMixFormSheet({ editingMix, onOpenChange, variants });

	return (
		<FormSheet
			formId={MIX_FORM_ID}
			isLoading={isPending}
			onOpenChange={handleOpenChange}
			open={open}
			title={formTitle}
		>
			<form
				className="flex flex-col gap-3"
				id={MIX_FORM_ID}
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="label">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={`${MIX_FORM_ID}-label`}
							label="Name"
							required
						>
							<Input
								id={`${MIX_FORM_ID}-label`}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="games">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={`${MIX_FORM_ID}-games`}
							label="Games"
							required
						>
							<div className="flex flex-col gap-2">
								{selectedGames.length > 0 ? (
									<div className="flex flex-wrap gap-1.5">
										{selectedGames.map((game) => (
											<Badge key={game.id} variant="secondary">
												{game.label}
												<button
													aria-label={`Remove ${game.label}`}
													className="ml-1 inline-flex"
													onClick={() => onRemoveGame(game.id)}
													type="button"
												>
													<IconX size={12} />
												</button>
											</Badge>
										))}
									</div>
								) : null}
								<VariantSelect
									excludeVariants={selectedGames.map((game) => game.label)}
									id={`${MIX_FORM_ID}-games`}
									includeMix={false}
									onChange={onAddGame}
									value=""
								/>
							</div>
						</Field>
					)}
				</form.Field>
			</form>
		</FormSheet>
	);
}
