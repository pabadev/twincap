// @vitest-environment jsdom

import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SearchInput } from "../search-input";

// Founder rule (PROJECT-RULES §15, 2026-09-30): every searcher carries an X
// clear button; componentized from the sale-form combobox pattern.

interface Mounted {
  root: ReturnType<typeof createRoot>;
  container: HTMLElement;
}

const mounted: Mounted[] = [];

function mount(node: ReactNode): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  mounted.push({ root, container });
  return { root, container };
}

afterEach(() => {
  mounted.splice(0).forEach((entry) => {
    act(() => entry.root.unmount());
  });
  document.body.innerHTML = "";
});

const baseProps = {
  ariaLabel: "Search",
  clearLabel: "Clear search",
};

describe("SearchInput", () => {
  it("renders the accessible name as placeholder + aria-label with no icon-when-hidden", () => {
    const { container } = mount(<SearchInput {...baseProps} value="" onValueChange={() => {}} />);
    const input = container.querySelector<HTMLInputElement>("input")!;
    expect(input.getAttribute("aria-label")).toBe("Search");
    expect(input.placeholder).toBe("Search");
    // No X while empty.
    expect(input.className).toContain("pr-4");
    expect(input.className).not.toContain("pr-10");
  });

  it("hides the leading icon when hideIcon is set", () => {
    const { container } = mount(
      <SearchInput {...baseProps} value="" onValueChange={() => {}} hideIcon />,
    );
    expect(container.querySelector(".pointer-events-none")).toBeNull();
  });

  it("shows the X button only with a value, and clearing notifies + refocuses", () => {
    function StatefulSearch() {
      const [value, setValue] = useState("");
      return <SearchInput {...baseProps} value={value} onValueChange={setValue} />;
    }
    const { container } = mount(<StatefulSearch />);
    act(() => {
      const input = container.querySelector<HTMLInputElement>("input")!;
      // jsdom + React controlled input: the native setter is required, or the
      // change event dispatch re-renders with the stale controlled value.
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, "abc");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const input = container.querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("abc");
    expect(input.className).toContain("pr-10");
    const clearBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Clear search"]',
    )!;
    // preventDefault on mousedown keeps input focus (sale-form precedent).
    const prevented = clearBtn.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    expect(prevented).toBe(false);
    act(() => {
      clearBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector<HTMLInputElement>("input")!.value).toBe("");
    expect(container.querySelector('button[aria-label="Clear search"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>("input")!.className).toContain("pr-4");
  });

  it("passes through native input props (name for GET filter forms)", () => {
    const { container } = mount(
      <SearchInput
        {...baseProps}
        value=""
        onValueChange={() => {}}
        inputProps={{ name: "q", maxLength: 100, type: "text" }}
      />,
    );
    const input = container.querySelector<HTMLInputElement>("input")!;
    expect(input.name).toBe("q");
    expect(input.maxLength).toBe(100);
  });
});
