import { pageUser } from '@/lib/auth';
import { LessonPlayer } from './lesson-player';

export const metadata = { title: 'Play · HeyToolie' };

export default async function PlayPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  await pageUser(`/play/${lessonId}`);
  return <LessonPlayer lessonId={lessonId} />;
}
