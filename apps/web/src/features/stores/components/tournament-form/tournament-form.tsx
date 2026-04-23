import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { TournamentFormValues } from "@/features/stores/hooks/use-tournaments";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { TagInput } from "@/shared/components/ui/tag-input";
import { Textarea } from "@/shared/components/ui/textarea";
import { useTournamentForm } from "./use-tournament-form";

const GAME_VARIANTS = {
	nlh: { label: "NL Hold'em" },
} as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface TournamentFormProps {
	defaultValues?: Omit<TournamentFormValues, "tags" | "chipPurchases"> & {
		chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
		tags?: string[];
	};
	isLoading?: boolean;
	onSubmit: (values: TournamentFormValues) => void;
}

export function TournamentForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: TournamentFormProps) {
	const { form, currencies } = useTournamentForm({ defaultValues, onSubmit });

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Tournament Name"
						required
					>
						<Input
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="variant">
				{(field) => (
					<Field htmlFor={field.name} label="Variant" required>
						<Select
							onValueChange={(v) => field.handleChange(v)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(GAME_VARIANTS).map(([key, val]) => (
									<SelectItem key={key} value={key}>
										{val.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<div className="grid grid-cols-2 gap-3">
				<form.Field name="buyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Buy-In"
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
				<form.Field name="entryFee">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Entry Fee"
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

			<form.Field name="startingStack">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Starting Stack"
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

			<form.Field mode="array" name="chipPurchases">
				{(field) => (
					<Field
						className="rounded-md border p-3"
						description="Define rebuy or add-on structures used during play."
						label="Chip Purchases"
					>
						<div className="flex items-center justify-between">
							<Button
								onClick={() =>
									field.pushValue({
										name: "",
										cost: "0",
										chips: "0",
										uid: crypto.randomUUID(),
									})
								}
								size="xs"
								type="button"
								variant="outline"
							>
								<IconPlus size={12} />
								Add
							</Button>
						</div>
						{field.state.value.length > 0 && (
							<div className="flex flex-col gap-2">
								{field.state.value.map((cp, index) => (
									<div className="flex items-end gap-2" key={cp.uid}>
										<form.Field name={`chipPurchases[${index}].name`}>
											{(sub) => (
												<Field
													className="flex flex-1 flex-col gap-1"
													htmlFor={`cp-name-${index}`}
													label="Name"
												>
													<Input
														id={`cp-name-${index}`}
														onChange={(e) => sub.handleChange(e.target.value)}
														value={sub.state.value}
													/>
												</Field>
											)}
										</form.Field>
										<form.Field name={`chipPurchases[${index}].cost`}>
											{(sub) => (
												<Field
													className="flex w-20 flex-col gap-1"
													htmlFor={`cp-cost-${index}`}
													label="Cost"
												>
													<Input
														id={`cp-cost-${index}`}
														inputMode="numeric"
														onChange={(e) => sub.handleChange(e.target.value)}
														value={sub.state.value}
													/>
												</Field>
											)}
										</form.Field>
										<form.Field name={`chipPurchases[${index}].chips`}>
											{(sub) => (
												<Field
													className="flex w-20 flex-col gap-1"
													htmlFor={`cp-chips-${index}`}
													label="Chips"
												>
													<Input
														id={`cp-chips-${index}`}
														inputMode="numeric"
														onChange={(e) => sub.handleChange(e.target.value)}
														value={sub.state.value}
													/>
												</Field>
											)}
										</form.Field>
										<Button
											aria-label="Remove chip purchase"
											onClick={() => field.removeValue(index)}
											size="icon-xs"
											type="button"
											variant="ghost"
										>
											<IconTrash size={12} />
										</Button>
									</div>
								))}
							</div>
						)}
					</Field>
				)}
			</form.Field>

			<form.Field name="bountyAmount">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Bounty Amount"
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

			<form.Field name="tableSize">
				{(field) => (
					<Field htmlFor={field.name} label="Table Size">
						<Select
							onValueChange={(v) => field.handleChange(v)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TABLE_SIZES.map((size) => (
									<SelectItem key={size} value={size.toString()}>
										{size}-max
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="currencyId">
				{(field) => (
					<Field htmlFor={field.name} label="Currency">
						<Select
							onValueChange={(v) => field.handleChange(v)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{currencies.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										{c.name}
										{c.unit ? ` (${c.unit})` : ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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
							rows={4}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="tags">
				{(field) => (
					<Field label="Tags">
						<TagInput
							onAdd={(tag) =>
								field.handleChange(
									field.state.value.includes(tag.name)
										? field.state.value
										: [...field.state.value, tag.name]
								)
							}
							onCreateTag={async (name) => ({ id: name, name })}
							onRemove={(tag) =>
								field.handleChange(
									field.state.value.filter((t) => t !== tag.name)
								)
							}
							selectedTags={field.state.value.map((name) => ({
								id: name,
								name,
							}))}
						/>
					</Field>
				)}
			</form.Field>

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, isSubmitting]) => (
					<Button
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
