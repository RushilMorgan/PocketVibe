import { pageUser } from '@/lib/auth';
import { RunView } from './run-view';

export const metadata = { title: 'Worked through · HeyToolie' };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await pageUser(`/playbook/runs/${id}`);
  return <RunView id={id} />;
}
