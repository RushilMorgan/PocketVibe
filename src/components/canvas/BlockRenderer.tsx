import type { VisualBlock, AppConfig } from '../../types';

interface BlockRendererProps {
  block: VisualBlock;
  appConfig: AppConfig;
  onInteract: (blockId: string, itemId?: string) => void;
}

export default function BlockRenderer({ block, appConfig, onInteract }: BlockRendererProps) {
  const isMinimal = appConfig.styleSlider > 60;
  const isPlayful = appConfig.styleSlider < 40;
  
  const cardRadius = Math.round(28 - (appConfig.styleSlider / 100) * 24);
  const accent = appConfig.accentColor;

  switch (block.type) {
    case 'hero_banner':
      return (
        <div style={{ backgroundColor: isMinimal ? '#ffffff' : `${accent}12`, borderRadius: cardRadius, padding: '24px', textAlign: 'center', marginBottom: '16px', border: isMinimal ? '1px solid #e5e7eb' : 'none', boxShadow: isMinimal ? 'none' : '0 10px 30px rgba(0,0,0,0.03)' }}>
          <h2 style={{ fontSize: isPlayful ? '28px' : '24px', fontWeight: 900, color: isMinimal ? '#111827' : accent, marginBottom: '8px', letterSpacing: isMinimal ? '-0.5px' : '0' }}>
            {block.title}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px', fontWeight: 600 }}>
            {block.subtitle}
          </p>
          <button 
            onClick={() => onInteract(block.id)}
            className="active:scale-[0.95] transition-transform"
            style={{ backgroundColor: accent, color: '#fff', borderRadius: '100px', padding: '10px 24px', fontSize: '14px', fontWeight: 800, border: 'none', boxShadow: `0 4px 14px ${accent}40`, cursor: 'pointer' }}
          >
            {block.ctaLabel}
          </button>
        </div>
      );
      
    case 'interactive_list':
      return (
        <div style={{ marginBottom: '20px' }}>
          {block.title && (
            <h3 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', color: isMinimal ? '#9ca3af' : accent }}>
              {block.title}
            </h3>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {block.items.map(item => (
              <button 
                key={item.id} 
                onClick={() => onInteract(block.id, item.id)}
                className="active:scale-[0.98] transition-transform w-[100%] text-left"
                style={{ 
                  display: 'flex', alignItems: 'center', padding: '16px', 
                  backgroundColor: isMinimal ? '#fff' : `${accent}06`, 
                  border: isMinimal ? '1px solid #e5e7eb' : 'none',
                  borderRadius: Math.max(12, cardRadius - 4),
                  boxShadow: isMinimal ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: isPlayful ? '26px' : '20px', marginRight: '16px', filter: isMinimal ? 'grayscale(1)' : 'none' }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#1f2937', fontSize: '15px' }}>{item.label}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginTop: '2px' }}>Interactive item</div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 800, padding: '4px 12px', borderRadius: '100px', backgroundColor: isMinimal ? '#f3f4f6' : `${accent}15`, color: isMinimal ? '#4b5563' : accent }}>
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
          className="active:scale-[0.95] transition-transform"
          style={{ width: '100%', padding: isPlayful ? '20px' : '16px', borderRadius: cardRadius, backgroundColor: accent, color: '#fff', fontSize: '16px', fontWeight: 900, border: 'none', boxShadow: `0 8px 24px ${accent}40`, marginBottom: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
          {block.icon && <span style={{ fontSize: '20px' }}>{block.icon}</span>}
          {block.label}
        </button>
      );
      
    case 'metrics_row':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          {block.metrics.map((m, i) => (
            <div key={i} style={{ backgroundColor: isMinimal ? '#ffffff' : `${accent}0A`, padding: '20px 16px', borderRadius: cardRadius, border: isMinimal ? '1px solid #e5e7eb' : 'none', textAlign: 'center', boxShadow: isMinimal ? '0 1px 4px rgba(0,0,0,0.04)' : 'none' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9ca3af', fontWeight: 800, marginBottom: '6px' }}>
                {m.label}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: isMinimal ? '#111827' : accent, letterSpacing: '-0.5px' }}>
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