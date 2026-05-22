import type { VisualBlock, AppConfig } from '../../types';

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
      
    case 'interactive_list':
      return (
        <div className="mb-5">
          {block.title && (
            <h3 className="text-[13px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--theme-accent)' }}>
              {block.title}
            </h3>
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
                <div className="flex-1">
                  <div className="font-extrabold text-theme-text text-[15px]">{item.label}</div>
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
              <div className="text-[11px] uppercase tracking-[1.5px] text-theme-text-muted font-extrabold mb-1.5">
                {m.label}
              </div>
              <div className="font-black text-theme-text tracking-tight transition-all duration-300" style={{ fontSize: isPlayful ? '28px' : '24px', color: isPlayful ? 'var(--theme-accent)' : 'var(--theme-text)', fontFamily: 'var(--theme-font-header)' }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      );
      
    default:
      return null;
  }
}