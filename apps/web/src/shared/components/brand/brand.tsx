import { IconCards } from "@tabler/icons-react";
import type { CSSProperties } from "react";

interface BrandMarkProps {
	className?: string;
	size?: number;
	style?: CSSProperties;
}

export function BrandMark({ size = 24, className, style }: BrandMarkProps) {
	return (
		<IconCards
			aria-hidden="true"
			className={className}
			size={size}
			stroke={2}
			style={{ display: "block", flexShrink: 0, ...style }}
		/>
	);
}

interface WordmarkProps {
	className?: string;
	size?: number;
	style?: CSSProperties;
}

export function Wordmark({ size = 18, className, style }: WordmarkProps) {
	return (
		<span
			className={className}
			style={{
				fontFamily: "var(--font-sans)",
				fontSize: size,
				fontWeight: 600,
				letterSpacing: "-0.01em",
				lineHeight: 1,
				...style,
			}}
		>
			sapphire
			<span
				style={{
					fontFamily: "var(--font-mono)",
					fontSize: size * 0.78,
					fontWeight: 500,
					verticalAlign: "super",
				}}
			>
				2
			</span>
		</span>
	);
}

interface LockupProps {
	className?: string;
	gap?: number;
	size?: number;
	style?: CSSProperties;
}

export function Lockup({ size = 24, gap = 8, className, style }: LockupProps) {
	return (
		<span
			className={className}
			style={{
				alignItems: "center",
				display: "inline-flex",
				gap,
				...style,
			}}
		>
			<BrandMark size={size} />
			<Wordmark size={size * 0.64} />
		</span>
	);
}
