import type { ThemeColors } from '../../../types';

interface Props {
  colors: ThemeColors;
}

export default function ContactSection({ colors }: Props) {
  return (
    <div className="px-5 mb-4">
      <h2 className="text-base font-bold mb-3" style={{ color: colors.headline }}>
        📞 Get In Touch
      </h2>
      <div
        className="flex flex-col gap-2.5 p-4 rounded-2xl"
        style={{ backgroundColor: colors.cardBg, transition: 'background-color 0.4s ease' }}
      >
        <input
          readOnly
          placeholder="Your Name"
          className="w-full px-3.5 py-2.5 rounded-xl text-sm text-gray-400 border bg-transparent pointer-events-none"
          style={{ borderColor: `${colors.accent}30` }}
        />
        <input
          readOnly
          placeholder="Phone Number"
          className="w-full px-3.5 py-2.5 rounded-xl text-sm text-gray-400 border bg-transparent pointer-events-none"
          style={{ borderColor: `${colors.accent}30` }}
        />
        <textarea
          readOnly
          placeholder="Message"
          rows={2}
          className="w-full px-3.5 py-2.5 rounded-xl text-sm text-gray-400 border bg-transparent resize-none pointer-events-none"
          style={{ borderColor: `${colors.accent}30` }}
        />
        <button
          className="w-full py-3 rounded-xl font-bold text-sm"
          style={{ backgroundColor: colors.primaryBtn, color: colors.primaryBtnText }}
        >
          Send Message
        </button>
        <p className="text-center text-xs" style={{ color: `${colors.body}80` }}>
          📍 Serving your area • Open 7 days a week
        </p>
      </div>
    </div>
  );
}
