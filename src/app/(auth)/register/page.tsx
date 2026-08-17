import { registerAction } from '../actions';
import { AuthForm } from '../auth-form';

export default function RegisterPage() {
  return (
    <AuthForm
      action={registerAction}
      title="Create Account"
      submitLabel="Register"
      alternateText="Already have an account?"
      alternateHref="/login"
      alternateLabel="Sign In"
    />
  );
}
