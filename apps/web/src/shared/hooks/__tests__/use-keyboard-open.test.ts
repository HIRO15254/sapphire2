import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useKeyboardOpen } from "@/shared/hooks/use-keyboard-open";

function mount<T extends HTMLElement>(element: T): T {
	document.body.append(element);
	return element;
}

function makeInput(type?: string): HTMLInputElement {
	const input = document.createElement("input");
	if (type !== undefined) {
		input.type = type;
	}
	return mount(input);
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("useKeyboardOpen", () => {
	it("starts closed when nothing is focused", () => {
		const { result } = renderHook(() => useKeyboardOpen());
		expect(result.current).toBe(false);
	});

	it("opens when a text input receives focus", async () => {
		const input = makeInput();
		const { result } = renderHook(() => useKeyboardOpen());
		act(() => input.focus());
		await waitFor(() => expect(result.current).toBe(true));
	});

	it("opens when a textarea receives focus", async () => {
		const textarea = mount(document.createElement("textarea"));
		const { result } = renderHook(() => useKeyboardOpen());
		act(() => textarea.focus());
		await waitFor(() => expect(result.current).toBe(true));
	});

	it("opens when a contenteditable element receives focus", async () => {
		const editable = mount(document.createElement("div"));
		editable.setAttribute("contenteditable", "true");
		editable.tabIndex = 0;
		const { result } = renderHook(() => useKeyboardOpen());
		act(() => editable.focus());
		await waitFor(() => expect(result.current).toBe(true));
	});

	it("opens for a search input", async () => {
		const input = makeInput("search");
		const { result } = renderHook(() => useKeyboardOpen());
		act(() => input.focus());
		await waitFor(() => expect(result.current).toBe(true));
	});

	it("stays closed for a checkbox", async () => {
		const input = makeInput("checkbox");
		const { result } = renderHook(() => useKeyboardOpen());
		act(() => input.focus());
		await waitFor(() => expect(result.current).toBe(false));
	});

	it("stays closed for a button", async () => {
		const button = mount(document.createElement("button"));
		const { result } = renderHook(() => useKeyboardOpen());
		act(() => button.focus());
		await waitFor(() => expect(result.current).toBe(false));
	});

	it("stays closed for an input inside a portaled sheet", async () => {
		const sheet = mount(document.createElement("div"));
		sheet.setAttribute("role", "dialog");
		const input = document.createElement("input");
		sheet.append(input);
		const { result } = renderHook(() => useKeyboardOpen());
		act(() => input.focus());
		await waitFor(() => expect(result.current).toBe(false));
	});

	it("closes again when the text input is blurred", async () => {
		const input = makeInput();
		const { result } = renderHook(() => useKeyboardOpen());
		act(() => input.focus());
		await waitFor(() => expect(result.current).toBe(true));
		act(() => input.blur());
		await waitFor(() => expect(result.current).toBe(false));
	});

	it("stays open when focus moves between two text inputs", async () => {
		const first = makeInput();
		const second = makeInput();
		const { result } = renderHook(() => useKeyboardOpen());
		act(() => first.focus());
		await waitFor(() => expect(result.current).toBe(true));
		act(() => second.focus());
		await waitFor(() => expect(result.current).toBe(true));
	});

	it("stops reacting to focus once unmounted", async () => {
		const input = makeInput();
		const { result, unmount } = renderHook(() => useKeyboardOpen());
		unmount();
		act(() => input.focus());
		await waitFor(() => expect(result.current).toBe(false));
	});
});
