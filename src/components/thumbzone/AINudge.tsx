import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';

interface AINudgeProps {
  message: string;
}

export default function AINudge({ message }: AINudgeProps) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(message.slice(0, i));
      if (i >= message.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 18);
    return () => clearInterval(interval);
  }, [message]);

  return (
    <div className="flex items-start gap-3 px-4 pt-3 pb-2">
      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-violet-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-violet-50 rounded-2xl rounded-tl-sm px-4 py-3">
          <p className="text-sm text-gray-700 leading-relaxed">
            {displayed}
            {!done && (
              <span className="inline-block w-[3px] h-[14px] bg-violet-400 ml-0.5 align-middle animate-pulse rounded-sm" />
            )}
          </p>
        </div>
        {done && (
          <div className="mt-2 flex gap-2">
            <span className="text-xs bg-violet-100 text-violet-700 font-semibold px-3 py-1 rounded-full cursor-pointer hover:bg-violet-200 transition-colors select-none">
              👆 Tap the background
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
