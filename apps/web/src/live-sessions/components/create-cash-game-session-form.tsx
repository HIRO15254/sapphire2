import { useForm } from "@tanstack/react-form";
import { useState } from "react";
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
	const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(
		undefined
	);
	const [selectedRingGameId, setSelectedRingGameId] = useState<
		string | undefined
	>(undefined);
	const [selectedCurrencyId, setSelectedCurrencyId] = useState<
		string | undefined
	>(undefined);

	const selectedRingGame = selectedRingGameId
		? ringGames.find((g) => g.id === selectedRingGameId)
		: null;

	const isCurrencyLocked =
		selectedRingGame?.currencyId !== null &&
		selectedRingGame?.currencyId !== undefined;

	const form = useForm({
		defaultValues: {
			initialBuyIn: "",
			memo: "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				storeId: selectedStoreId,
				ringGameId: selectedRingGameId,
				currencyId: selectedCurrencyId,
				initialBuyIn: Number(value.initialBuyIn),
				memo: value.memo || undefined,
			});
		},
	});

	const handleStoreChange = (value: string) => {
		setSelectedStoreId(value);
		setSelectedRingGameId(undefined);
		form.setFieldValue("initialBuyIn", "");
		onStoreChange?.(value);
	};

	const handleRingGameChange = (value: string) => {
		setSelectedRingGameId(value);
		const ringGame = ringGames.find((g) => g.id === value);
		if (ringGame) {
			form.setFieldValue("initialBuyIn", ringGame.maxBuyIn?.toString() ?? "");
			setSelectedCurrencyId(ringGame.currencyId ?? undefined);
		}
	};

	const handleCurrencyChange = (value: string) => {
		setSelectedCurrencyId(value);
	};

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
					<Select onValueChange={handleStoreChange} value={selectedStoreId}>
						<SelectTrigger>
							<SelectValue placeholder="未指定のまま開始できます" />
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
					<p className="text-muted-foreground text-xs">
						店舗がまだありません。未指定のまま開始できます。
					</p>
				)}
			</Field>

			{selectedStoreId ? (
				<Field label="Ring Game">
					{hasRingGames ? (
						<Select
							onValueChange={handleRingGameChange}
							value={selectedRingGameId}
						>
							<SelectTrigger>
								<SelectValue placeholder="未指定のまま開始できます" />
							</SelectTrigger>
							<SelectContent>
								{ringGames.map((game) => (
									<SelectItem key={game.id} value={game.id}>
										{game.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<EmptyState
							className="px-4 py-8"
							description="セッション開始後に作成・割り当てもできます。"
							heading="No ring games available"
						/>
					)}
				</Field>
			) : null}

			{currencies.length > 0 ? (
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
							placeholder="Notes about this session"
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
