import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import type { VisualBlock, AppConfig } from '../../types';

// ── Sandboxed iframe renderer for generative_html blocks ──────────────────────
// Tailwind v4 is build-time only — classes in runtime strings produce no CSS.
// We solve this by wrapping the AI markup in a complete HTML document (srcdoc)
// that loads the Tailwind Play CDN so ALL utility classes resolve at runtime.

function GenerativeHtmlFrame({ markup }: { markup: string }) {
  const [height, setHeight] = useState(300);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sanitized = DOMPurify.sanitize(markup, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['object', 'embed', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onmouseover', 'onfocus', 'onblur'],
  });

  // Tiny inline script reports rendered body height back via postMessage
  const srcdoc = [
    '<!DOCTYPE html><html><head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<script src="https://cdn.tailwindcss.com"><\/script>',
    '<style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:transparent;overflow-x:hidden}</style>',
    '</head><body>',
    sanitized,
    '<script>',
    'function reportH(){var h=document.documentElement.scrollHeight;window.parent.postMessage({pvHeight:h},"*");}',
    'if(document.readyState==="complete"){setTimeout(reportH,150);}',
    'window.addEventListener("load",function(){setTimeout(reportH,300);});',
    '<\/script>',
    '</body></html>',
  ].join('');

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      // Accept only messages from our specific iframe
      if (
        iframeRef.current &&
        e.source === iframeRef.current.contentWindow &&
        typeof e.data?.pvHeight === 'number' &&
        e.data.pvHeight > 0
      ) {
        setHeight(e.data.pvHeight + 16);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      title="Generative UI"
      className="w-full rounded-2xl border-0 block transition-all duration-500"
      style={{ height: `${height}px`, minHeight: '200px' }}
    />
  );
}

interface BlockRendererProps {
  block: VisualBlock;
  appConfig: AppConfig;
  onInteract: (blockId: string, itemId?: string) => void;
}

export default function BlockRenderer({ block, appConfig, onInteract }: BlockRendererProps) {
  const isPlayful = appConfig.styleSlider < 40;

  switch (block.type) {
    case 'hero_banner':
      return (
        <div className="bg-theme-surface rounded-theme p-6 text-center mb-4 transition-all duration-300" style={{ border: 'var(--theme-border)', boxShadow: 'var(--theme-shadow)' }}>
          <h2 className="text-theme-text font-black mb-2 transition-all duration-300" style={{ fontSize: isPlayful ? '28px' : '24px', fontFamily: 'var(--theme-font-header)' }}>
            {block.title}
          </h2>
          <p className="text-theme-text-muted text-[13px] font-semibold mb-5">
            {block.subtitle}
          </p>
          <button 
            onClick={() => onInteract(block.id)}
            className="active:scale-95 transition-transform rounded-full px-6 py-2.5 text-sm font-extrabold text-white border-none cursor-pointer"
            style={{ backgroundColor: 'var(--theme-accent)', boxShadow: '0 4px 14px color-mix(in srgb, var(--theme-accent) 40%, transparent)' }}
          >
            {block.ctaLabel}
          </button>
        </div>
      );
      
    case 'interactive_list': {
      const doneCount = block.items.filter(i => i.state === 'Done' || i.state === 'Stocked').length;
      const totalCount = block.items.length;
      return (
        <div className="mb-5">
          {block.title && (
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-black uppercase tracking-widest" style={{ color: 'var(--theme-accent)' }}>
                {block.title}
              </h3>
              {totalCount > 0 && (
                <span
                  className="text-[11px] font-extrabold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: doneCount === totalCount ? 'var(--theme-accent)' : 'var(--theme-surface-hover)',
                    color: doneCount === totalCount ? '#fff' : 'var(--theme-text-muted)',
                  }}
                >
                  {doneCount} / {totalCount} done
                </span>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {block.items.map(item => (
              <button 
                key={item.id} 
                onClick={() => onInteract(block.id, item.id)}
                className="active:scale-[0.98] transition-transform w-full text-left flex items-center p-4 bg-theme-surface rounded-theme cursor-pointer"
                style={{ border: 'var(--theme-border)', boxShadow: 'var(--theme-shadow)' }}
              >
                <div className="mr-4 transition-all duration-300" style={{ fontSize: isPlayful ? '26px' : '20px' }}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-theme-text text-[15px] truncate">{item.label}</div>
                  <div className="text-[11px] text-theme-text-muted font-semibold mt-0.5">Interactive item</div>
                </div>
                <div className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-theme-surface-hover transition-colors duration-300" style={{ color: 'var(--theme-accent)' }}>
                  {item.state}
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }
      
    case 'action_button':
      return (
        <button 
          onClick={() => onInteract(block.id)}
          className="active:scale-[0.95] transition-transform w-full rounded-theme text-white text-[16px] font-black border-none mb-4 flex justify-center items-center gap-3 cursor-pointer"
          style={{ padding: isPlayful ? '20px' : '16px', backgroundColor: 'var(--theme-accent)', boxShadow: '0 8px 24px color-mix(in srgb, var(--theme-accent) 40%, transparent)' }}
        >
          {block.icon && <span className="text-[20px]">{block.icon}</span>}
          {block.label}
        </button>
      );
      
    case 'metrics_row':
      return (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {block.metrics.map((m, i) => (
            <div key={i} className="bg-theme-surface p-5 rounded-theme text-center transition-all duration-300" style={{ border: 'var(--theme-border)', boxShadow: 'var(--theme-shadow)' }}>
              <div className="text-[11px] uppercase tracking-[1.5px] text-theme-text-muted font-extrabold mb-1.5 truncate">
                {m.label}
              </div>
              <div className="font-black text-theme-text tracking-tight transition-all duration-300" style={{ fontSize: isPlayful ? '28px' : '24px', color: isPlayful ? 'var(--theme-accent)' : 'var(--theme-text)', fontFamily: 'var(--theme-font-header)' }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      );

    case 'interactive_form':
      return (
        <div className="bg-theme-surface rounded-theme p-5 mb-4 border border-black/5" style={{ boxShadow: 'var(--theme-shadow)' }}>
          <h3 className="text-[13px] font-black uppercase tracking-widest mb-4 truncate" style={{ color: 'var(--theme-accent)' }}>
            {block.title}
          </h3>
          {block.fields.map(field => (
            <div key={field.id}>
              {field.type === 'slider' ? (
                <div className="mb-3">
                  <label className="text-[11px] font-bold text-theme-text-muted">{field.label}: {field.value}</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={field.value}
                    onChange={(e) => onInteract(block.id, `${field.id}:${e.target.value}`)}
                    className="w-full appearance-none h-1 rounded-full bg-gray-200 mt-1"
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                </div>
              ) : (
                <div className="mb-3">
                  <label className="text-[11px] font-bold text-theme-text-muted block mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={(e) => onInteract(block.id, `${field.id}:${e.target.value}`)}
                    className="w-full px-4 py-2.5 bg-black/5 rounded-xl font-bold text-sm focus:outline-none text-theme-text"
                    placeholder={field.placeholder}
                  />
                </div>
              )}
            </div>
          ))}
          {block.computedMetrics && block.computedMetrics.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-black/5">
              {block.computedMetrics.map((metric, i) => (
                <div key={i} className="bg-black/5 p-4 rounded-2xl text-center">
                  <div className="text-[10px] uppercase tracking-wider text-theme-text-muted font-bold mb-1 truncate">{metric.label}</div>
                  <div className="text-xl font-black text-theme-text">{metric.value || '0'}</div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => onInteract(block.id)}
            className="w-full mt-4 rounded-theme text-white text-sm font-extrabold py-3 active:scale-[0.97] transition-transform border-none cursor-pointer"
            style={{ backgroundColor: 'var(--theme-accent)', boxShadow: '0 4px 14px color-mix(in srgb, var(--theme-accent) 40%, transparent)' }}
          >
            {block.submitLabel}
          </button>
        </div>
      );

    case 'generative_html':
      return <GenerativeHtmlFrame markup={block.tailwindMarkup} />;

    default:
      return null;
  }
}