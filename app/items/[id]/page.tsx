import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ItemView } from './item-view';

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getCurrentUser())) redirect(`/login?next=/items/${id}`);
  return <ItemView id={id} />;
}
