import { Logo } from '../../../components/ui/logo';
import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="flex justify-center">
        <Logo variant="isotipo" size="lg" />
      </div>
      <ForgotPasswordForm />
    </>
  );
}
