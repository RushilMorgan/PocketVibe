import { pageUser } from '@/lib/auth';
import { RecipesView } from './recipes-view';

export const metadata = { title: 'Recipes · HeyToolie' };

export default async function RecipesPage() {
  await pageUser('/recipes');
  return <RecipesView />;
}
