import type { Metadata } from 'next';
import { RecipeExtractor } from './recipe-extractor';

// Public landing page for ad traffic — kept at its original URL.
const description =
  'Paste a cooking-video link or recipe text and get a clean recipe — ingredient list and step-by-step method. Free, no sign-up.';

export const metadata: Metadata = {
  title: 'Recipe Extractor — Turn any cooking video into a clean recipe | HeyToolie',
  description,
  alternates: { canonical: 'https://heytoolie.com/tools/recipe-extractor' },
  openGraph: { title: 'Recipe Extractor — Turn any cooking video into a clean recipe', description },
};

export default async function RecipeExtractorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { url } = await searchParams;
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Recipe Extractor</h1>
      <p className="mt-2 text-muted">Turn any cooking video or recipe page into a clean, easy-to-follow recipe.</p>
      <RecipeExtractor initialUrl={url ?? ''} />
    </div>
  );
}
