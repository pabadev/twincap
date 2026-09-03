import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { connectDb } from '../../../infrastructure/db/connection';
import { MongoUserRepository } from '../../../infrastructure/repositories/user-repository';
import { getT, getLocale } from '../../../i18n/server';
import { ProfileForm } from './profile-form';
import { VerifyBanner } from './verify-banner';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect('/login');

  const t = await getT('Profile');
  const locale = await getLocale();

  await connectDb();
  const userRepo = new MongoUserRepository();
  const user = await userRepo.findById(authUser.userId);
  if (!user) redirect('/login');

  const snapshot = user.toJSON();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        {t('title')}
      </h1>
      {snapshot.emailVerified === false && (
        <VerifyBanner
          title={t('emailNotVerified')}
          description={t('emailNotVerifiedHint')}
          resend={t('resendVerification')}
        />
      )}
      <ProfileForm
        name={snapshot.name ?? ''}
        email={snapshot.email}
        locale={snapshot.locale ?? locale}
        translations={{
          name: t('name'),
          namePlaceholder: t('namePlaceholder'),
          email: t('email'),
          language: t('language'),
          saveProfile: t('saveProfile'),
          profileSaved: t('profileSaved'),
          changePassword: t('changePassword'),
          currentPassword: t('currentPassword'),
          newPassword: t('newPassword'),
          confirmNewPassword: t('confirmNewPassword'),
          passwordChanged: t('passwordChanged'),
          wrongPassword: t('wrongPassword'),
          passwordMismatch: t('passwordMismatch'),
          cancel: (await getT('Common'))('cancel'),
        }}
      />
    </div>
  );
}
