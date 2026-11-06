import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class ResizeObserverMock {
	// biome-ignore lint/style/useThisInClassMethods: The ResizeObserver mock implements the instance API without state.
	disconnect = () => undefined;

	// biome-ignore lint/style/useThisInClassMethods: The ResizeObserver mock implements the instance API without state.
	observe = () => undefined;

	// biome-ignore lint/style/useThisInClassMethods: The ResizeObserver mock implements the instance API without state.
	unobserve = () => undefined;
}

Object.defineProperty(globalThis, "ResizeObserver", {
	configurable: true,
	value: ResizeObserverMock,
});

Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
	configurable: true,
	value: () => false,
});

Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
	configurable: true,
	value: () => undefined,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
	configurable: true,
	value: () => undefined,
});

Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
	configurable: true,
	value: () => undefined,
});

afterEach(() => {
	cleanup();
});
