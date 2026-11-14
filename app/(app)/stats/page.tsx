import { pageUser } from '@/lib/auth';
import { StatsView } from './stats-view';

export const metadata = { title: 'Your stats · HeyToolie' };

export default async function StatsPage() {
  await pageUser('/stats');
  return <StatsView />;
}
