import { Chat } from '@/components/chat';
import { pageUser } from '@/lib/auth';

export const metadata = { title: 'Ask · HeyToolie' };

export default async function AskPage() {
  await pageUser('/ask');
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Ask your library</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Answers come only from what you&apos;ve saved, with links to the sources.</p>
      <Chat
        placeholder="e.g. what have I saved about RAG?"
        empty={
          <p className="mb-4 rounded-xl border border-dashed border-line p-4 text-sm text-muted">
            Try: &ldquo;What&apos;s the difference between the two vector database videos I saved?&rdquo;
          </p>
        }
      />
    </div>
  );
}
