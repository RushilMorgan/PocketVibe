/**
 * Smart fallback emoji for recipe ingredients and steps, so every recipe has
 * helpful visuals even when the AI hasn't supplied an explicit emoji.
 * Keyword-matched, client-side, zero-cost. The AI-provided `emoji` (when set)
 * always takes precedence in the renderer.
 */

const INGREDIENT_ICONS: Array<[RegExp, string]> = [
  [/\b(chicken|poultry)\b/i, '🍗'],
  [/\b(beef|steak|mince|brisket)\b/i, '🥩'],
  [/\b(pork|bacon|ham|sausage)\b/i, '🥓'],
  [/\b(fish|salmon|tuna|cod|anchov)\b/i, '🐟'],
  [/\b(prawn|shrimp|crab|lobster|mussel|seafood)\b/i, '🦐'],
  [/\begg(s)?\b/i, '🥚'],
  [/\b(milk|cream|yoghurt|yogurt)\b/i, '🥛'],
  [/\b(cheese|parmesan|mozzarella|cheddar|feta)\b/i, '🧀'],
  [/\b(butter|ghee)\b/i, '🧈'],
  [/\b(flour|bread|dough|loaf|bun)\b/i, '🍞'],
  [/\b(rice|risotto)\b/i, '🍚'],
  [/\b(pasta|spaghetti|noodle|macaroni|penne)\b/i, '🍝'],
  [/\b(potato|fries|chips)\b/i, '🥔'],
  [/\b(tomato|passata|marinara)\b/i, '🍅'],
  [/\b(onion|shallot|leek)\b/i, '🧅'],
  [/\b(garlic)\b/i, '🧄'],
  [/\b(carrot)\b/i, '🥕'],
  [/\b(chilli|chili|pepper|paprika|cayenne)\b/i, '🌶️'],
  [/\b(mushroom)\b/i, '🍄'],
  [/\b(broccoli|greens|spinach|kale|lettuce|salad)\b/i, '🥬'],
  [/\b(avocado)\b/i, '🥑'],
  [/\b(lemon|lime|citrus)\b/i, '🍋'],
  [/\b(orange)\b/i, '🍊'],
  [/\b(apple)\b/i, '🍎'],
  [/\b(banana)\b/i, '🍌'],
  [/\b(berry|berries|strawberr|blueberr|raspberr)\b/i, '🍓'],
  [/\b(corn|maize)\b/i, '🌽'],
  [/\b(bean|lentil|chickpea|legume)\b/i, '🫘'],
  [/\b(sugar|honey|syrup|sweet)\b/i, '🍯'],
  [/\b(chocolate|cocoa|cacao)\b/i, '🍫'],
  [/\b(salt)\b/i, '🧂'],
  [/\b(oil|olive)\b/i, '🫒'],
  [/\b(water|stock|broth)\b/i, '💧'],
  [/\b(wine|vinegar)\b/i, '🍷'],
  [/\b(herb|basil|parsley|coriander|cilantro|thyme|mint|rosemary)\b/i, '🌿'],
  [/\b(spice|cumin|curry|cinnamon|ginger|turmeric|nutmeg)\b/i, '🥄'],
  [/\b(nut|almond|cashew|peanut|walnut|tahini|sesame)\b/i, '🥜'],
];

const STEP_ICONS: Array<[RegExp, string]> = [
  [/\b(chop|dice|slice|cut|mince|julienne)\b/i, '🔪'],
  [/\b(boil|simmer|poach)\b/i, '🍲'],
  [/\b(fry|saut|sear|pan)\b/i, '🍳'],
  [/\b(bake|oven|roast)\b/i, '🔥'],
  [/\b(grill|barbecue|bbq|char)\b/i, '🔥'],
  [/\b(mix|stir|whisk|beat|combine|fold|blend)\b/i, '🥣'],
  [/\b(season|salt|pepper|sprinkle|taste)\b/i, '🧂'],
  [/\b(pour|drizzle)\b/i, '🥤'],
  [/\b(serve|plate|garnish|enjoy)\b/i, '🍽️'],
  [/\b(rest|chill|cool|refrigerate|fridge|marinate|set aside|wait)\b/i, '⏳'],
  [/\b(measure|weigh|prepare|prep|gather)\b/i, '📋'],
  [/\b(knead|roll|shape|press)\b/i, '👐'],
  [/\b(wash|rinse|clean|drain)\b/i, '🚰'],
];

// Whole-dish matches checked before ingredient words, so "Chicken Burger"
// reads as a burger rather than chicken.
const DISH_ICONS: Array<[RegExp, string]> = [
  [/\b(pizza)\b/i, '🍕'],
  [/\b(burger)\b/i, '🍔'],
  [/\b(taco|burrito|quesadilla|fajita)\b/i, '🌮'],
  [/\b(soup|stew|broth|ramen)\b/i, '🍲'],
  [/\b(salad|bowl)\b/i, '🥗'],
  [/\b(cake|cheesecake|cupcake|brownie|muffin)\b/i, '🍰'],
  [/\b(cookie|biscuit)\b/i, '🍪'],
  [/\b(pancake|waffle|crepe|flapjack)\b/i, '🥞'],
  [/\b(curry)\b/i, '🍛'],
  [/\b(sushi|poke)\b/i, '🍣'],
  [/\b(pie|tart|quiche)\b/i, '🥧'],
  [/\b(sandwich|toastie|wrap|sub)\b/i, '🥪'],
  [/\b(smoothie|shake|juice)\b/i, '🥤'],
  [/\b(stir.?fry|wok)\b/i, '🥡'],
];

export function ingredientEmoji(name: string): string {
  for (const [re, emoji] of INGREDIENT_ICONS) if (re.test(name)) return emoji;
  return '🥘';
}

/** Best emoji for a whole recipe title — dish names first, then ingredients. */
export function dishEmoji(title: string): string {
  for (const [re, emoji] of DISH_ICONS) if (re.test(title)) return emoji;
  return ingredientEmoji(title);
}

export function stepEmoji(text: string): string {
  for (const [re, emoji] of STEP_ICONS) if (re.test(text)) return emoji;
  return '👩‍🍳';
}
