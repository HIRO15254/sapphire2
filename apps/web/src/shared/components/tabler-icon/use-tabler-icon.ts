import { useSyncExternalStore } from "react";
import {
	getIconDataVersion,
	iconGlyph,
	subscribeIconData,
} from "@/shared/lib/tabler-icons/icon-data";

export function useTablerIcon(name: string, fallback: string | undefined) {
	useSyncExternalStore(
		subscribeIconData,
		getIconDataVersion,
		getIconDataVersion
	);
	const glyph = name ? iconGlyph(name) : null;
	if (glyph !== null || !fallback) {
		return { glyph: glyph ?? null, isFallback: false };
	}
	return { glyph: iconGlyph(fallback) ?? null, isFallback: true };
}
