// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientsList, type SerializedClient } from "./clients-list";

vi.mock("../../../i18n/client", () => ({ useT: () => (key: string) => key }));
vi.mock("./client-form", () => ({
  ClientForm: ({ client }: { client?: SerializedClient }) => (
    <div data-editing-client={client?.id ?? "new"} />
  ),
}));
vi.mock("./delete-client-button", () => ({ DeleteClientButton: () => null }));
vi.mock("../../../components/ui/modal", () => ({
  Modal: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="client-modal">{children}</div> : null,
}));

const clients: SerializedClient[] = [
  { id: "legacy-client", name: "Cliente anterior", phone: "", email: "", note: "" },
  { id: "identified-client", name: "Cliente nuevo", phone: "+573001234567", email: "", note: "" },
];

let cleanup: (() => void) | undefined;

function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
}

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = "";
});

describe("ClientsList legacy phone prompt", () => {
  it("shows a warning and opens the incomplete client's edit form", () => {
    const container = mount(<ClientsList clients={clients} />);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("legacyPhoneWarning");
    const button = [...container.querySelectorAll("button")].find((item) =>
      item.textContent?.includes("completePhone"),
    );
    expect(button).toBeDefined();
    act(() => button?.click());
    expect(container.querySelector('[data-editing-client="legacy-client"]')).not.toBeNull();
  });
});
