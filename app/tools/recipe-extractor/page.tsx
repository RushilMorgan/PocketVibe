import type { Metadata } from 'next';
import { pageUser } from '@/lib/auth';
import { RecipeExtractor } from './recipe-extractor';

// Kept at its original URL so old links still land somewhere; sign-in required.
export const metadata: Metadata = {
  title: 'Recipe Extractor | HeyToolie',
  robots: { index: false, follow: false },
};

export default async function RecipeExtractorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { url } = await searchParams;
  await pageUser(url ? `/tools/recipe-extractor?url=${encodeURIComponent(url)}` : '/tools/recipe-extractor');
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Recipe Extractor</h1>
      <p className="mt-2 text-muted">Turn any cooking video or recipe page into a clean, easy-to-follow recipe.</p>
      <RecipeExtractor initialUrl={url ?? ''} />
    </div>
  );
}
