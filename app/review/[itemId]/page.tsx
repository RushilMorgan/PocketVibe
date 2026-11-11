import { pageUser } from '@/lib/auth';
import { ReviewView } from './review-view';

export const metadata = { title: 'Quick recall · HeyToolie' };

/** Full-screen review card (no tab bar), like the lesson player. */
export default async function ReviewPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  await pageUser(`/review/${itemId}`);
  return <ReviewView itemId={itemId} />;
}
