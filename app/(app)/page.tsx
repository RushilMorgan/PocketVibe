import { pageUser } from '@/lib/auth';
import type { FeedFilter } from '@/components/types';
import { Home } from './home';

const NOTICES: Record<string, string> = {
  nolink: "That share didn't include a link.",
  cap: "That's today's limit — save it again tomorrow.",
};

const FILTERS: FeedFilter[] = ['unread', 'whatif', 'recipe'];

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageUser('/');
  const { share, topic, filter } = await searchParams;
  return (
    <Home
      notice={share ? NOTICES[share] : undefined}
      initialTopic={topic ?? null}
      initialFilter={FILTERS.includes(filter as FeedFilter) ? (filter as FeedFilter) : null}
    />
  );
}
