import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import { FieldSeparator } from "@/shared/components/ui/field";

interface AuthFormLayoutProps {
	alert?: ReactNode;
	children: ReactNode;
	description: string;
	isBusy: boolean;
	onSwitchMode: () => void;
	providers: ReactNode;
	switchActionLabel: string;
	switchPrompt: string;
	title: string;
}

export function AuthFormLayout({
	alert,
	children,
	description,
	isBusy,
	onSwitchMode,
	providers,
	switchActionLabel,
	switchPrompt,
	title,
}: AuthFormLayoutProps) {
	return (
		<main className="mx-auto flex w-full max-w-[440px] flex-col gap-5 px-3.5 pt-12 pb-6 text-[length:var(--m-text-secondary)]">
			<div className="flex flex-col gap-1.5">
				<span className="font-semibold tracking-[var(--tracking-heading)] text-[length:var(--m-text-title)]">
					Sapphire 2
				</span>
				<h1 className="m-0 leading-[1.25] font-semibold tracking-[var(--tracking-heading)] text-[length:var(--m-text-title-lg)]">
					{title}
				</h1>
				<p className="text-muted-foreground m-0 leading-normal">
					{description}
				</p>
			</div>
			<div className="flex flex-col gap-2">{providers}</div>
			<FieldSeparator>or</FieldSeparator>
			{alert}
			{children}
			<p className="text-muted-foreground m-0 text-center">
				{switchPrompt}{" "}
				<Button
					className="text-[length:inherit] hover:no-underline"
					disabled={isBusy}
					onClick={onSwitchMode}
					type="button"
					variant="link"
				>
					{switchActionLabel}
				</Button>
			</p>
		</main>
	);
}
