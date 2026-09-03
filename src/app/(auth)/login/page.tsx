import { getT } from '../../../i18n/server';
import { loginAction } from '../actions';
import { AuthForm } from '../auth-form';
import { Logo } from '../../../components/ui/logo';

export default async function LoginPage() {
  const t = await getT('Auth');
  return (
    <>
      <div className="flex justify-center">
        <Logo variant="isotipo" size="lg" />
      </div>
      <AuthForm
        action={loginAction}
        title={t('signIn')}
        submitLabel={t('signInLabel')}
        alternateText={t('noAccount')}
        alternateHref="/register"
        alternateLabel={t('registerLabel')}
        authMode="login"
        forgotLabel={t('forgotPassword')}
        forgotHref="/forgot-password"
      />
    </>
  );
}
