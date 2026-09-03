import { Logo } from '../../../components/ui/logo';
import { VerifyEmailForm } from './verify-email-form';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token = '', email = '' } = await searchParams;

  return (
    <>
      <div className="flex justify-center">
        <Logo variant="isotipo" size="lg" />
      </div>
      <div className="mt-6">
        <VerifyEmailForm email={email} token={token} />
      </div>
    </>
  );
}
