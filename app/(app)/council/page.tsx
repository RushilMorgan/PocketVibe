import { pageUser } from '@/lib/auth';
import { CouncilHome } from './council-home';

export const metadata = { title: 'Council · HeyToolie' };

export default async function CouncilPage() {
  await pageUser('/council');
  return <CouncilHome />;
}
