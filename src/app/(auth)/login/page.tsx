import { loginAction } from '../actions';
import { AuthForm } from '../auth-form';

export default function LoginPage() {
  return (
    <AuthForm
      action={loginAction}
      title="Sign In"
      submitLabel="Sign In"
      alternateText="Don't have an account?"
      alternateHref="/register"
      alternateLabel="Register"
    />
  );
}
