'use client';

import { useActionState } from 'react';
import { Input } from '../../../components/ui/input';
import { PasswordInput } from '../../../components/ui/password-input';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Select } from '../../../components/ui/select';
import { useToast } from '../../../lib/hooks/use-toast';
import { updateProfileAction, changePasswordAction } from './actions';

interface ProfileFormTranslations {
  name: string;
  namePlaceholder: string;
  email: string;
  language: string;
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
  translations: ProfileFormTranslations;
}

const LOCALE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

export function ProfileForm({ name, email, locale, translations: t }: ProfileFormProps) {
  const { addToast } = useToast();

  const [profileState, profileAction, profilePending] = useActionState(
    async (_prev: { error?: string; success?: string } | null, formData: FormData) => {
      const result = await updateProfileAction(_prev, formData);
      if (result.success) addToast(t.profileSaved, 'success');
      if (result.error) addToast(result.error, 'error');
      return result;
    },
    null,
  );

  const [passwordState, passwordAction, passwordPending] = useActionState(
    async (_prev: { error?: string; success?: string } | null, formData: FormData) => {
      const result = await changePasswordAction(_prev, formData);
      if (result.success) addToast(t.passwordChanged, 'success');
      if (result.error) {
        let msg = t.wrongPassword;
        if (result.error === 'passwordMismatch') msg = t.passwordMismatch;
        addToast(msg, 'error');
      }
      return result;
    },
    null,
  );

  return (
    <>
      <Card title={t.name}>
        <form action={profileAction} className="space-y-4">
          <Input
            name="name"
            label={t.name}
            placeholder={t.namePlaceholder}
            defaultValue={name}
          />
          <Input
            name="email"
            label={t.email}
            defaultValue={email}
            disabled
          />
          <Select
            name="locale"
            label={t.language}
            options={LOCALE_OPTIONS}
            defaultValue={locale}
          />
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
