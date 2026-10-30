import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Home } from './home';

const NOTICES: Record<string, string> = {
  nolink: "That share didn't include a link.",
  cap: "That's today's limit — save it again tomorrow.",
};

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await getCurrentUser())) redirect('/login');
  const { share } = await searchParams;
  return <Home notice={share ? NOTICES[share] : undefined} />;
}
