import { pageUser } from '@/lib/auth';
import { CookView } from './cook-view';

export const metadata = { title: 'Cooking · HeyToolie' };

/** Full-screen cooking view (no tab bar): one step per screen, with timers. */
export default async function CookPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  await pageUser(`/cook/${itemId}`);
  return <CookView itemId={itemId} />;
}
