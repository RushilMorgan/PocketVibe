import { pageUser } from '@/lib/auth';
import { PlaybookView } from './playbook-view';

export const metadata = { title: 'Playbook · HeyToolie' };

export default async function PlaybookPage({ searchParams }: { searchParams: Promise<{ use?: string }> }) {
  await pageUser('/playbook');
  const { use } = await searchParams;
  return <PlaybookView use={use} />;
}
