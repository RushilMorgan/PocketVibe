import { pageUser } from '@/lib/auth';
import { TopicList } from './topic-list';

export const metadata = { title: 'Topics · HeyToolie' };

export default async function TopicsPage() {
  await pageUser('/topics');
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Your topics</h1>
      <p className="mt-1 text-sm text-muted">
        Built from what you save. Saves add 1, 👍 adds 2, 👎 takes 2, and everything fades 10% a week. Your top 5 shape
        every explanation.
      </p>
      <TopicList />
    </div>
  );
}
