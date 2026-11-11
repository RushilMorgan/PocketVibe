import { pageUser } from '@/lib/auth';
import { TopicsView } from './topics-view';

export const metadata = { title: 'Topics · HeyToolie' };

export default async function TopicsPage() {
  await pageUser('/topics');
  return <TopicsView />;
}
