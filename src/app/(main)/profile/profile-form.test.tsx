// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./profile-form";

// Beta feedback (B1): the defaultCurrency select is uncontrolled no more —
// React 19 reset the form after the action resolved, so the saved choice
// vanished right after the success toast. The observable contract: the
// chosen currency STAYS visible after saving, and the server state is
// re-synced via router.refresh().

vi.mock("../../../i18n/client", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "es",
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => refresh(),
    push: () => {},
    replace: () => {},
    back: () => {},
    prefetch: () => {},
  }),
}));

const updateProfileAction = vi.fn();
vi.mock("./actions", () => ({
  updateProfileAction: (...args: unknown[]) => updateProfileAction(...args),
  changePasswordAction: vi.fn(async () => ({})),
}));

vi.mock("../../../lib/hooks/use-toast", () => ({
  useToast: () => ({ addToast: () => {} }),
}));

vi.mock("../../../lib/use-action-error", () => ({
  useActionError: () => (error: string) => error,
}));

const translations = {
  name: "name",
  namePlaceholder: "namePlaceholder",
  email: "email",
  language: "language",
  defaultCurrency: "defaultCurrency",
  defaultCurrencyHint: "defaultCurrencyHint",
  saveProfile: "saveProfile",
  profileSaved: "profileSaved",
  changePassword: "changePassword",
  currentPassword: "currentPassword",
  newPassword: "newPassword",
  confirmNewPassword: "confirmNewPassword",
  passwordChanged: "passwordChanged",
  wrongPassword: "wrongPassword",
  passwordMismatch: "passwordMismatch",
  cancel: "cancel",
};

interface Mounted {
  unmount: () => void;
}

const mounted: Mounted[] = [];

function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  const entry = {
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
  mounted.push(entry);
  return { container };
}

afterEach(() => {
  mounted.splice(0).forEach((entry) => entry.unmount());
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("ProfileForm defaultCurrency persistence (B1)", () => {
  it("keeps the chosen currency visible after saving and refreshes the server state", async () => {
    updateProfileAction.mockResolvedValue({ success: "profileSaved" });
    const { container } = mount(
      <ProfileForm name="Name" email="e@x.com" locale="es" translations={translations} />,
    );

    const select = container.querySelector<HTMLSelectElement>('select[name="defaultCurrency"]')!;
    // Start with no saved currency (the reported scenario).
    expect(select.value).toBe("");

    act(() => {
      select.value = "COP";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(select.value).toBe("COP");

    const form = select.closest("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(updateProfileAction).toHaveBeenCalledTimes(1);
    // React 19 resets the DOM form after the action; the form re-mounts with
    // the submitted values, so the saved choice stays on screen — no silent
    // revert to blank/—. (The node is replaced by the re-mount: re-query.)
    const selectAfterSave = container.querySelector<HTMLSelectElement>(
      'select[name="defaultCurrency"]',
    )!;
    expect(selectAfterSave.value).toBe("COP");
    const nameAfterSave = container.querySelector<HTMLInputElement>('input[name="name"]')!;
    expect(nameAfterSave.value).toBe("Name");
    // Server state re-synced so the rest of the app sees the saved currency.
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
