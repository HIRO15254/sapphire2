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
				<span className="font-semibold text-[length:var(--m-text-title)] tracking-[var(--tracking-heading)]">
					Sapphire 2
				</span>
				<h1 className="m-0 font-semibold text-[length:var(--m-text-title-lg)] leading-[1.25] tracking-[var(--tracking-heading)]">
					{title}
				</h1>
				<p className="m-0 text-muted-foreground leading-normal">
					{description}
				</p>
			</div>
			<div className="flex flex-col gap-2">{providers}</div>
			<FieldSeparator>or</FieldSeparator>
			{alert}
			{children}
			<p className="m-0 text-center text-muted-foreground">
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
