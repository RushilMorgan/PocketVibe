import { Send } from 'lucide-react';

export default function ChatInput() {
  return (
    <div className="px-4 py-3 flex items-center gap-2">
      <div className="flex-1 flex items-center bg-gray-100 rounded-2xl px-4 py-2.5">
        <input
          type="text"
          placeholder="Ask me to change anything..."
          className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
          readOnly
        />
      </div>
      <button
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 transition-colors hover:opacity-90 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
        aria-label="Send"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
