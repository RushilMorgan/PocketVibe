import { pageUser } from '@/lib/auth';
import { DigestView } from './digest-view';

export const metadata = { title: 'Your week · HeyToolie' };

export default async function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await pageUser(`/digest/${id}`);
  return <DigestView id={id} />;
}
