import React from 'react';
import type { LandingPageContent } from '../../types';

interface LandingPageRendererProps {
  content: LandingPageContent;
}

export function LandingPageRenderer({ content }: LandingPageRendererProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white p-6 text-center">
        <h1 className="text-2xl font-extrabold mb-2 leading-tight">{content.businessName}</h1>
        <p className="text-sm opacity-90 leading-relaxed">{content.tagline}</p>
        {content.ctaLabel && (
          <a
            href={content.ctaUrl || '#'}
            target={content.ctaUrl ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="inline-block mt-4 px-5 py-2.5 bg-white text-pink-600 text-sm font-bold rounded-full active:scale-95 transition-transform"
          >
            {content.ctaLabel}
          </a>
        )}
      </div>

      {/* Description */}
      {content.description && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-600 leading-relaxed">{content.description}</p>
        </div>
      )}

      {/* Features */}
      {content.features && content.features.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">What we offer</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {content.features.map((f, idx) => (
              <div key={idx} className="flex items-start gap-3 px-4 py-3">
                <span className="text-xl leading-none flex-shrink-0">{f.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{f.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{f.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      {content.contactEmail && (
        <div className="bg-gray-50 rounded-2xl p-4 text-center">
          <p className="text-sm text-gray-500">Get in touch</p>
          <a href={`mailto:${content.contactEmail}`} className="text-sm font-semibold text-pink-600 mt-1 block">
            {content.contactEmail}
          </a>
        </div>
      )}
    </div>
  );
}
