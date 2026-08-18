import { getT } from '../../../i18n/server';
import { registerAction } from '../actions';
import { AuthForm } from '../auth-form';

export default async function RegisterPage() {
  const t = await getT('Auth');
  return (
    <AuthForm
      action={registerAction}
      title={t('createAccount')}
      submitLabel={t('register')}
      alternateText={t('hasAccount')}
      alternateHref="/login"
      alternateLabel={t('signInLabel')}
    />
  );
}
