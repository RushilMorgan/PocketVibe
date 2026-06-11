/**
 * Tappable example starters for the Idea Board intake — contextual to the
 * selected category so they feel personally relevant. With no category, a
 * diverse mix demonstrates the breadth of what Toolie can help with.
 */

export interface Starter {
  emoji: string;
  text: string;
}

export function startersFor(categoryId: string | null): Starter[] {
  switch (categoryId) {
    case 'business':
      return [
        { emoji: '☕', text: 'A coffee cart that sets up outside office parks in the mornings' },
        { emoji: '🧹', text: 'A cleaning service for Airbnbs and short-term rentals in my area' },
        { emoji: '🎂', text: 'A custom cake business I run from home on weekends' },
      ];
    case 'app':
      return [
        { emoji: '👴', text: 'An app that helps elderly people stay connected with family easily' },
        { emoji: '💊', text: 'A medication reminder app for people managing chronic conditions' },
        { emoji: '🏠', text: 'An app that helps tenants and landlords communicate without drama' },
      ];
    case 'side-hustle':
      return [
        { emoji: '🎨', text: 'Selling handmade candles or soaps online and at markets' },
        { emoji: '📸', text: 'Charging for photography at family events and small businesses' },
        { emoji: '✏️', text: 'Tutoring school kids in maths and science on afternoons' },
      ];
    case 'product':
      return [
        { emoji: '🥗', text: 'A meal prep container that actually keeps food fresh for 3 days' },
        { emoji: '👜', text: 'A bag designed specifically for people who work from coffee shops' },
        { emoji: '🌱', text: 'A simple starter kit that makes it easy to grow herbs at home' },
      ];
    case 'service':
      return [
        { emoji: '🐕', text: 'Dog walking and pet care for busy professionals in my neighbourhood' },
        { emoji: '🚗', text: 'A mobile car wash that comes to people at their office or home' },
        { emoji: '👩‍💻', text: 'Helping small businesses get set up on social media and online' },
      ];
    case 'event':
      return [
        { emoji: '🎲', text: 'A monthly board game night that could turn into a regular paid club' },
        { emoji: '🍷', text: 'A wine and food pairing evening for people who want to learn more' },
        { emoji: '🧘', text: 'A weekend wellness retreat focused on stress and burnout recovery' },
      ];
    case 'creative':
      return [
        { emoji: '🎙️', text: 'A podcast about hidden gems, local food spots, and culture in my city' },
        { emoji: '✍️', text: 'A newsletter about personal finance written for people in their 20s' },
        { emoji: '🎥', text: 'Short videos teaching practical life skills nobody taught us in school' },
      ];
    default:
      // No category selected — show a diverse mix covering different use cases
      return [
        { emoji: '💼', text: 'A coffee cart that sets up outside office parks in the mornings' },
        { emoji: '🤔', text: 'Should I leave my job to freelance full-time, or keep both going?' },
        { emoji: '📱', text: 'The difference between building a mobile app and a web app' },
        { emoji: '🎂', text: 'A home cake business I want to start on weekends' },
      ];
  }
}
