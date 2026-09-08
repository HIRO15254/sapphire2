import { useState } from "react";

interface UseCurrencySheetOptions {
	onAdd: (values: { name: string; unit: string }) => Promise<unknown>;
}

export function useCurrencySheet({ onAdd }: UseCurrencySheetOptions) {
	const [name, setName] = useState("");
	const [unit, setUnit] = useState("");

	const onSubmitNew = async () => {
		const trimmedName = name.trim();
		const trimmedUnit = unit.trim();
		if (trimmedName === "" || trimmedUnit === "") {
			return;
		}
		await onAdd({ name: trimmedName, unit: trimmedUnit });
		setName("");
		setUnit("");
	};

	return {
		canSubmitNew: name.trim() !== "" && unit.trim() !== "",
		name,
		onNameChange: setName,
		onSubmitNew,
		onUnitChange: setUnit,
		unit,
	};
}
