import { X } from 'lucide-react';
import type { ExtraBlockType } from '../../types';

interface AddSectionMenuProps {
  onAdd: (type: ExtraBlockType) => void;
  onClose: () => void;
}

const BLOCKS: { type: ExtraBlockType; emoji: string; title: string; desc: string }[] = [
  {
    type: 'testimonials',
    emoji: '⭐️',
    title: 'Testimonials & Reviews',
    desc: 'Show customer reviews to build trust instantly.',
  },
  {
    type: 'services-pricing',
    emoji: '📋',
    title: 'Services & Pricing List',
    desc: 'A clean pricing table for all your services.',
  },
  {
    type: 'contact',
    emoji: '📞',
    title: 'Contact / Info Form',
    desc: 'Let customers reach you directly from your site.',
  },
];

export default function AddSectionMenu({ onAdd, onClose }: AddSectionMenuProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full bg-white rounded-t-3xl p-5 z-10 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Add New Section</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {BLOCKS.map((block) => (
            <button
              key={block.type}
              onClick={() => onAdd(block.type)}
              className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-gray-50 hover:bg-violet-50 active:scale-[0.98] transition-all text-left"
            >
              <span className="text-2xl w-9 text-center shrink-0">{block.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{block.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{block.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
