/** Three bouncing dots shown next to the stage currently being worked on. */
export function ThinkingDots() {
  return (
    <span className="inline-flex gap-0.5 ml-0.5" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-white/80 animate-dot-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
