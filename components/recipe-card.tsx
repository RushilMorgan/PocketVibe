import type { Recipe } from '@/lib/handlers/schemas';

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <article>
      <h2 className="text-2xl font-semibold tracking-tight">{recipe.title}</h2>
      <p className="mt-1 text-muted">{recipe.description}</p>
      <p className="mt-3 text-sm text-muted">
        Serves {recipe.servings} · Prep {recipe.prepTime} · Cook {recipe.cookTime}
      </p>

      <h3 className="mt-6 font-semibold">Ingredients</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {recipe.ingredients.map((ing, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden>{ing.emoji}</span>
            <span>
              {[ing.quantity, ing.unit].filter(Boolean).join(' ')} {ing.name}
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 font-semibold">Method</h3>
      <ol className="mt-2 flex flex-col gap-3">
        {recipe.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-white">
              {i + 1}
            </span>
            <span>
              {step.text}
              {step.time && <span className="ml-1 text-sm text-muted">({step.time})</span>}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
