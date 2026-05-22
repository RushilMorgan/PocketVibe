import type { ThemeColors } from '../../../types';

interface Props {
  colors: ThemeColors;
}

const TESTIMONIALS = [
  { name: 'Sarah K.', text: 'Amazing service! My dog looks absolutely incredible!' },
  { name: 'Mike T.', text: 'Best groomer in town. Will definitely be returning.' },
];

export default function TestimonialsSection({ colors }: Props) {
  return (
    <div className="px-5 mb-4">
      <h2 className="text-base font-bold mb-3" style={{ color: colors.headline }}>
        ⭐ What Customers Say
      </h2>
      <div className="flex flex-col gap-2.5">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            className="p-3.5 rounded-xl"
            style={{ backgroundColor: colors.cardBg, transition: 'background-color 0.4s ease' }}
          >
            <div className="flex gap-0.5 mb-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="text-yellow-400 text-xs">★</span>
              ))}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: colors.body }}>
              "{t.text}"
            </p>
            <p className="text-xs font-bold mt-1.5" style={{ color: colors.accent }}>
              — {t.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
