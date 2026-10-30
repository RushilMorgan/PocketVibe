import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './login-form';

const ERRORS: Record<string, string> = {
  link: 'That sign-in link has expired. Send yourself a new one.',
  invite: 'HeyToolie is invite-only for now.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await getCurrentUser()) redirect('/');
  const { error, share, next } = await searchParams;
  return (
    <div className="pt-16">
      <h1 className="text-3xl font-semibold tracking-tight">HeyToolie</h1>
      <p className="mt-2 text-muted">
        {share ? 'Sign in and your link will be saved straight away.' : 'Share any link. Get the useful version back.'}
      </p>
      {error && ERRORS[error] && <p className="mt-6 rounded-lg bg-surface p-3 text-sm text-danger">{ERRORS[error]}</p>}
      <LoginForm next={next ?? '/'} />
    </div>
  );
}
