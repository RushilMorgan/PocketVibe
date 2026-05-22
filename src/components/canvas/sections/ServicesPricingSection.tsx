import type { ThemeColors } from '../../../types';

interface Props {
  colors: ThemeColors;
}

const ITEMS = [
  { service: 'Bath & Blow-Dry', price: 'from $45', popular: true },
  { service: 'Full Groom & Trim', price: 'from $65', popular: false },
  { service: 'Nail Trim', price: 'from $15', popular: false },
  { service: 'Teeth Brushing', price: 'from $10', popular: false },
  { service: 'Flea Treatment Add-on', price: 'from $20', popular: false },
];

export default function ServicesPricingSection({ colors }: Props) {
  return (
    <div className="px-5 mb-4">
      <h2 className="text-base font-bold mb-3" style={{ color: colors.headline }}>
        📋 Services &amp; Pricing
      </h2>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${colors.accent}25` }}
      >
        {ITEMS.map((item, i) => (
          <div
            key={item.service}
            className="flex items-center justify-between px-4 py-3"
            style={{
              backgroundColor: i % 2 === 0 ? colors.cardBg : 'transparent',
              borderBottom: i < ITEMS.length - 1 ? `1px solid ${colors.accent}15` : 'none',
              transition: 'background-color 0.4s ease',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: colors.headline }}>
                {item.service}
              </span>
              {item.popular && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${colors.accent}22`, color: colors.accent }}
                >
                  Popular
                </span>
              )}
            </div>
            <span className="text-sm font-bold" style={{ color: colors.accent }}>
              {item.price}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
