import { getT } from '../../../i18n/server';
import { registerAction } from '../actions';
import { AuthForm } from '../auth-form';
import { Logo } from '../../../components/ui/logo';

export default async function RegisterPage() {
  const t = await getT('Auth');
  return (
    <>
      <div className="flex justify-center">
        <Logo variant="isotipo" size="lg" />
      </div>
      <AuthForm
        action={registerAction}
        title={t('createAccount')}
        submitLabel={t('register')}
        alternateText={t('hasAccount')}
        alternateHref="/login"
        alternateLabel={t('signInLabel')}
      />
    </>
  );
}
