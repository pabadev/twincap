import { getT } from '../../../i18n/server';
import { loginAction } from '../actions';
import { AuthForm } from '../auth-form';

export default async function LoginPage() {
  const t = await getT('Auth');
  return (
    <AuthForm
      action={loginAction}
      title={t('signIn')}
      submitLabel={t('signInLabel')}
      alternateText={t('noAccount')}
      alternateHref="/register"
      alternateLabel={t('registerLabel')}
    />
  );
}
