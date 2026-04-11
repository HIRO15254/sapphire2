import type * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

export function TagNameForm({
	children,
	defaultName,
	isLoading,
	onSubmit,
}: {
	children?: React.ReactNode;
	defaultName?: string;
	isLoading?: boolean;
	onSubmit: (name: string) => void;
}) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		onSubmit(name);
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="tag-name" label="Tag Name" required>
				<Input
					defaultValue={defaultName}
					id="tag-name"
					maxLength={50}
					minLength={1}
					name="name"
					placeholder="Enter tag name"
					required
				/>
			</Field>
			{children}
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
