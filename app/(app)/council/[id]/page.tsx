import { pageUser } from '@/lib/auth';
import { SessionView } from './session-view';

export const metadata = { title: 'Council · HeyToolie' };

export default async function CouncilSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await pageUser(`/council/${id}`);
  return <SessionView id={id} />;
}
