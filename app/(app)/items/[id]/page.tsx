import { pageUser } from '@/lib/auth';
import { ItemView } from './item-view';

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await pageUser(`/items/${id}`);
  return <ItemView id={id} />;
}
