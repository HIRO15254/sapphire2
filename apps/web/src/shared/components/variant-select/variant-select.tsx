import { FormSheet } from "@/shared/components/form-sheet";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/shared/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { useVariantSelect } from "./use-variant-select";

interface VariantSelectProps {
	disabled?: boolean;
	/** Variant labels hidden from the options. */
	excludeVariants?: string[];
	id?: string;
	/** Show the special "Mixed Game" mode entry (value: "mix"). */
	includeMix?: boolean;
	onChange: (variant: string) => void;
	value: string;
}

function VariantOption({
	active,
	children,
	id,
	onSelect,
}: {
	active: boolean;
	children: React.ReactNode;
	id: string;
	onSelect: () => void;
}) {
	return (
		<Button
			aria-selected={active}
			className="h-auto w-full cursor-default justify-start rounded-sm px-2 py-1.5 font-normal data-selected:bg-accent data-selected:text-accent-foreground"
			data-selected={active ? "true" : undefined}
			id={id}
			onClick={onSelect}
			onMouseDown={(event) => event.preventDefault()}
			role="option"
			size="sm"
			tabIndex={-1}
			type="button"
			variant="ghost"
		>
			{children}
		</Button>
	);
}

/**
 * Required variant picker shared by every game/rule form — a type-to-filter
 * combobox (Input + Popover + active-descendant ARIA listbox).
 * Options are the user's own variant rows (seeded at signup, fully editable
 * on the Games page), plus the user's named mix masters (HORSE / 8-Game /
 * custom, shown under a "Mixes" heading) where a mix editor exists, plus a
 * trailing "Add custom variant" action that creates a row (name + short
 * label + owning group, pre-seeded from the typed draft) and selects it.
 */
export function VariantSelect({
	disabled = false,
	excludeVariants,
	id,
	includeMix = false,
	onChange,
	value,
}: VariantSelectProps) {
	const {
		activeOptionId,
		activeOptionValue,
		anchorRef,
		contentWidth,
		filteredMixOptions,
		filteredVariantOptions,
		form,
		formId,
		getOptionId,
		getOptionValue,
		groups,
		handleInputBlur,
		handleInputChange,
		handleInputFocus,
		handleKeyDown,
		handleOpenAdd,
		handleSelect,
		inputValue,
		isAddOpen,
		isCreatePending,
		isLoading,
		listboxId,
		setIsAddOpen,
		shouldShowPopover,
	} = useVariantSelect({ excludeVariants, includeMix, onChange, value });

	const hasMatches =
		filteredVariantOptions.length > 0 || filteredMixOptions.length > 0;

	return (
		<>
			<Popover
				modal={false}
				onOpenChange={() => undefined}
				open={shouldShowPopover}
			>
				<PopoverAnchor asChild>
					<div ref={anchorRef}>
						<Input
							aria-activedescendant={
								shouldShowPopover ? activeOptionId : undefined
							}
							aria-autocomplete="list"
							aria-controls={listboxId}
							aria-expanded={shouldShowPopover}
							aria-haspopup="listbox"
							autoComplete="off"
							disabled={disabled || isLoading}
							id={id}
							onBlur={(e) => {
								const relatedTarget = e.relatedTarget as HTMLElement | null;
								handleInputBlur(relatedTarget);
							}}
							onChange={(e) => handleInputChange(e.target.value)}
							onFocus={handleInputFocus}
							onKeyDown={(e) => {
								if (handleKeyDown(e.key)) {
									e.preventDefault();
								}
							}}
							role="combobox"
							value={inputValue}
						/>
					</div>
				</PopoverAnchor>
				{shouldShowPopover ? (
					<PopoverContent
						align="start"
						className="p-0"
						onFocusOutside={(e) => e.preventDefault()}
						onOpenAutoFocus={(e) => e.preventDefault()}
						style={contentWidth ? { width: contentWidth } : undefined}
					>
						<div
							className="max-h-72 overflow-y-auto overflow-x-hidden"
							id={listboxId}
							role="listbox"
						>
							{hasMatches ? null : (
								<p className="py-6 text-center text-muted-foreground text-sm">
									No matching games
								</p>
							)}
							{filteredVariantOptions.map((option) => (
								<VariantOption
									active={
										activeOptionValue === getOptionValue("variant", option.id)
									}
									id={getOptionId("variant", option.id)}
									key={option.id}
									onSelect={() => handleSelect(option.label)}
								>
									{option.label}
								</VariantOption>
							))}
							{filteredMixOptions.length > 0 ? (
								<div
									className="overflow-hidden p-1 text-foreground"
									role="presentation"
								>
									<div
										aria-hidden="true"
										className="px-2 py-1.5 font-medium text-muted-foreground text-xs"
									>
										Mixes
									</div>
									{filteredMixOptions.map((option) => (
										<VariantOption
											active={
												activeOptionValue === getOptionValue("mix", option.id)
											}
											id={getOptionId("mix", option.id)}
											key={option.id}
											onSelect={() => handleSelect(option.label)}
										>
											{option.label}
										</VariantOption>
									))}
								</div>
							) : null}
							<hr className="-mx-1 border-border" />
							<VariantOption
								active={
									activeOptionValue === getOptionValue("create", "custom")
								}
								id={getOptionId("create", "custom")}
								onSelect={handleOpenAdd}
							>
								Add custom variant
							</VariantOption>
						</div>
					</PopoverContent>
				) : null}
			</Popover>
			<FormSheet
				formId={formId}
				isLoading={isCreatePending}
				onOpenChange={setIsAddOpen}
				open={isAddOpen}
				title="New custom variant"
			>
				<form
					className="flex flex-col gap-3"
					id={formId}
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
								htmlFor={`${formId}-label`}
								label="Name"
								required
							>
								<Input
									id={`${formId}-label`}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
					<div className="grid grid-cols-2 gap-3">
						<form.Field name="shortLabel">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={`${formId}-shortLabel`}
									label="Short label"
								>
									<Input
										id={`${formId}-shortLabel`}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>
						<form.Field name="groupId">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={`${formId}-groupId`}
									label="Group"
									required
								>
									<Select
										onValueChange={(v) => field.handleChange(v)}
										value={field.state.value}
									>
										<SelectTrigger className="w-full" id={`${formId}-groupId`}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{groups.map((group) => (
												<SelectItem key={group.id} value={group.id}>
													{group.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							)}
						</form.Field>
					</div>
				</form>
			</FormSheet>
		</>
	);
}
