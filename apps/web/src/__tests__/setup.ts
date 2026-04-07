import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class ResizeObserverMock {
	disconnect() {
		return undefined;
	}

	observe() {
		return undefined;
	}

	unobserve() {
		return undefined;
	}
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
