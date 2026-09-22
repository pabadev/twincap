"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../i18n/client";
import { useActionError } from "../../../lib/use-action-error";
import { Input } from "../../../components/ui/input";
import { PasswordInput } from "../../../components/ui/password-input";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Select } from "../../../components/ui/select";
import { useToast } from "../../../lib/hooks/use-toast";
import { updateProfileAction, changePasswordAction } from "./actions";
import { CURRENCIES } from "../../../core/domain/currency";

interface ProfileFormTranslations {
  name: string;
  namePlaceholder: string;
  email: string;
  language: string;
  defaultCurrency: string;
  defaultCurrencyHint: string;
  saveProfile: string;
  profileSaved: string;
  changePassword: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  passwordChanged: string;
  wrongPassword: string;
  passwordMismatch: string;
  cancel: string;
}

interface ProfileFormProps {
  name: string;
  email: string;
  locale: string;
  defaultCurrency?: string;
  translations: ProfileFormTranslations;
}

const LOCALE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

const CURRENCY_OPTIONS = [
  { value: "", label: "—" },
  ...CURRENCIES.map((c) => ({ value: c, label: c })),
];

export function ProfileForm({
  name,
  email,
  locale,
  defaultCurrency,
  translations: t,
}: ProfileFormProps) {
  const { addToast } = useToast();
  const translateError = useActionError();
  const router = useRouter();
  // I8: generic fallback text when an action returns an unknown error key.
  const tError = useT("error");
  const genericError = tError("operationFailed");

  // Beta feedback: React 19 automatically resets the DOM form after a form
  // action resolves — including controlled fields when no re-render follows
  // (state unchanged → React never rewrites the reset DOM value). The saved
  // currency therefore vanished right after the success toast. Fix: hold the
  // editable fields in controlled state, and on success re-mount the form
  // (key bump) seeded with the SUBMITTED values so every field keeps showing
  // what was saved. router.refresh() then re-syncs the server-rendered props.
  const [profileDraft, setProfileDraft] = useState({
    name,
    locale,
    defaultCurrency: defaultCurrency ?? "",
  });
  const [profileTick, setProfileTick] = useState(0);

  const [, profileAction, profilePending] = useActionState(
    async (_prev: { error?: string; success?: string } | null, formData: FormData) => {
      const result = await updateProfileAction(_prev, formData);
      if (result.success) {
        setProfileDraft({
          name: String(formData.get("name") ?? ""),
          locale: String(formData.get("locale") ?? "es"),
          defaultCurrency: String(formData.get("defaultCurrency") ?? ""),
        });
        setProfileTick((tick) => tick + 1);
        addToast(t.profileSaved, "success");
        router.refresh();
      }
      // updateProfileAction returns error.* i18n keys — resolve them (I8).
      if (result.error) addToast(translateError(result.error, genericError), "error");
      return result;
    },
    null,
  );

  const [, passwordAction, passwordPending] = useActionState(
    async (_prev: { error?: string; success?: string } | null, formData: FormData) => {
      const result = await changePasswordAction(_prev, formData);
      if (result.success) addToast(t.passwordChanged, "success");
      if (result.error) {
        // Distinguish the password-flow results: the two bare sentinel keys
        // map to their Profile messages; everything else is an error.* i18n
        // key resolved via useActionError, with operationFailed as fallback.
        let msg: string;
        if (result.error === "passwordMismatch") msg = t.passwordMismatch;
        else if (result.error === "wrongPassword") msg = t.wrongPassword;
        else if (result.error === "tooManyAttempts") {
          msg = translateError("error.tooManyAttempts", genericError);
        } else {
          msg = translateError(result.error, genericError);
        }
        addToast(msg, "error");
      }
      return result;
    },
    null,
  );

  return (
    <>
      <Card title={t.name}>
        <form key={profileTick} action={profileAction} className="space-y-4">
          <Input
            name="name"
            label={t.name}
            placeholder={t.namePlaceholder}
            value={profileDraft.name}
            onChange={(e) => setProfileDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <Input name="email" label={t.email} defaultValue={email} disabled />
          <Select
            name="locale"
            label={t.language}
            options={LOCALE_OPTIONS}
            value={profileDraft.locale}
            onChange={(e) => setProfileDraft((d) => ({ ...d, locale: e.target.value }))}
          />
          <Select
            name="defaultCurrency"
            label={t.defaultCurrency}
            options={CURRENCY_OPTIONS}
            value={profileDraft.defaultCurrency}
            onChange={(e) => setProfileDraft((d) => ({ ...d, defaultCurrency: e.target.value }))}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.defaultCurrencyHint}</p>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={profilePending}>
              {t.saveProfile}
            </Button>
          </div>
        </form>
      </Card>

      <Card title={t.changePassword}>
        <form action={passwordAction} className="space-y-4">
          <PasswordInput
            name="currentPassword"
            label={t.currentPassword}
            required
            autoComplete="current-password"
          />
          <PasswordInput
            name="newPassword"
            label={t.newPassword}
            required
            autoComplete="new-password"
          />
          <PasswordInput
            name="confirmPassword"
            label={t.confirmNewPassword}
            required
            autoComplete="new-password"
          />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={passwordPending}>
              {t.changePassword}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
