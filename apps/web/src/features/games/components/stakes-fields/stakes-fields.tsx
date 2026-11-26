import { ANTE_TYPE_OPTIONS } from "@/features/games/utils/stakes";
import { cn } from "@/lib/utils";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import {
	type UseStakesFieldsOptions,
	useStakesFields,
} from "./use-stakes-fields";

export function StakesFields(props: UseStakesFieldsOptions) {
	const { cards } = useStakesFields(props);

	return (
		<div className="flex flex-col gap-2">
			<h3 className="text-muted-foreground m-0 text-[11px] font-semibold tracking-[var(--tracking-caps)] uppercase">
				Stakes
			</h3>
			{cards.map((card) => (
				<section
					aria-label={`${card.name} stakes`}
					className="bg-card border-border flex flex-col gap-3 rounded-lg border p-3"
					key={card.key}
				>
					<div className="flex items-baseline gap-2">
						<span className="font-semibold">{card.name}</span>
						<span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
							{card.games}
						</span>
					</div>
					{card.blinds.length > 0 ? (
						<div className={cn("grid items-start gap-2", card.blindColumns)}>
							{card.blinds.map((blind) => (
								<Field
									error={blind.error}
									htmlFor={blind.id}
									key={blind.field}
									label={blind.label}
									required={blind.required}
								>
									<Input
										autoComplete="off"
										id={blind.id}
										inputMode="numeric"
										onChange={blind.onChange}
										size="xl"
										type="text"
										value={blind.value}
									/>
								</Field>
							))}
						</div>
					) : null}
					<div className="flex flex-col gap-1.5">
						<div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-2">
							<div className="flex min-w-0 flex-col gap-1.5">
								<span className="text-foreground text-sm font-medium">
									Ante
								</span>
								<ToggleGroup
									aria-label={card.anteType.label}
									disabled={card.anteType.locked}
									onValueChange={card.anteType.onChange}
									role="radiogroup"
									type="single"
									value={card.anteType.value}
								>
									{ANTE_TYPE_OPTIONS.map((option) => (
										<ToggleGroupItem
											className="px-2"
											key={option.value}
											value={option.value}
										>
											{option.label}
										</ToggleGroupItem>
									))}
								</ToggleGroup>
							</div>
							<Field
								error={card.ante.error}
								htmlFor={card.ante.id}
								label="Amount"
							>
								<Input
									aria-label={card.ante.label}
									autoComplete="off"
									disabled={card.ante.disabled}
									id={card.ante.id}
									inputMode="numeric"
									onChange={card.ante.onChange}
									size="xl"
									type="text"
									value={card.ante.value}
								/>
							</Field>
						</div>
						{card.anteType.note ? (
							<p className="text-muted-foreground m-0 leading-normal text-[length:var(--m-text-footnote)]">
								{card.anteType.note}
							</p>
						) : null}
					</div>
				</section>
			))}
		</div>
	);
}
