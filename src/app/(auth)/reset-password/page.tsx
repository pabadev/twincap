import { Logo } from '../../../components/ui/logo';
import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token = '', email = '' } = await searchParams;

  // Without a token (or email) the reset cannot proceed — show a readable fallback
  // by rendering the form with empty seed values so the action surfaces the error.
  return (
    <>
      <div className="flex justify-center">
        <Logo variant="isotipo" size="lg" />
      </div>
      <ResetPasswordForm email={email} token={token} />
    </>
  );
}
