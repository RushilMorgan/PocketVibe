import React, { useState } from 'react';
import type { LandingPageContent, LandingFeature } from '../../types';

interface LandingPageRendererProps {
  content: LandingPageContent;
  onChange: (updated: LandingPageContent) => void;
}

export function LandingPageRenderer({ content, onChange }: LandingPageRendererProps) {
  const [editMode, setEditMode] = useState(false);

  function updateFeature(idx: number, patch: Partial<LandingFeature>) {
    const features = content.features.map((f, i) => i === idx ? { ...f, ...patch } : f);
    onChange({ ...content, features });
  }

  function addFeature() {
    onChange({
      ...content,
      features: [...content.features, { icon: '⭐', title: 'New feature', description: 'What this offers' }],
    });
  }

  function deleteFeature(idx: number) {
    onChange({ ...content, features: content.features.filter((_, i) => i !== idx) });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Edit toggle */}
      <div className="flex justify-end">
        <button
          data-testid="edit-landing-btn"
          onClick={() => setEditMode(e => !e)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            editMode ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {editMode ? 'Done' : 'Edit page'}
        </button>
      </div>

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white p-6 text-center">
        {editMode ? (
          <div className="space-y-2">
            <input
              data-testid="business-name-input"
              value={content.businessName}
              onChange={e => onChange({ ...content, businessName: e.target.value })}
              className="w-full text-xl font-extrabold bg-white/20 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 text-center"
              placeholder="Business name"
            />
            <input
              value={content.tagline}
              onChange={e => onChange({ ...content, tagline: e.target.value })}
              className="w-full text-sm bg-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 text-center opacity-90"
              placeholder="Your tagline"
            />
            <input
              data-testid="cta-label-input"
              value={content.ctaLabel}
              onChange={e => onChange({ ...content, ctaLabel: e.target.value })}
              className="w-full text-sm bg-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 text-center"
              placeholder="Button label"
            />
            <input
              value={content.ctaUrl ?? ''}
              onChange={e => onChange({ ...content, ctaUrl: e.target.value })}
              className="w-full text-sm bg-white/20 rounded-lg px-3 py-1.5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 text-center"
              placeholder="Button URL (optional)"
            />
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Description */}
      {editMode ? (
        <textarea
          value={content.description}
          onChange={e => onChange({ ...content, description: e.target.value })}
          rows={3}
          placeholder="Description"
          className="w-full text-sm border border-gray-200 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-pink-400"
        />
      ) : content.description ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-600 leading-relaxed">{content.description}</p>
        </div>
      ) : null}

      {/* Features */}
      {(content.features.length > 0 || editMode) && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {!editMode && (
            <div className="px-4 py-3 border-b border-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">What we offer</h3>
            </div>
          )}
          <div className="divide-y divide-gray-50">
            {content.features.map((f, idx) => (
              <div key={idx} className="flex items-start gap-3 px-4 py-3">
                {editMode ? (
                  <>
                    <input
                      value={f.icon}
                      onChange={e => updateFeature(idx, { icon: e.target.value })}
                      className="w-10 text-center text-lg border border-gray-200 rounded-lg px-1 py-1 focus:outline-none"
                    />
                    <div className="flex-1 space-y-1">
                      <input
                        value={f.title}
                        onChange={e => updateFeature(idx, { title: e.target.value })}
                        className="w-full text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                        placeholder="Feature title"
                      />
                      <input
                        value={f.description}
                        onChange={e => updateFeature(idx, { description: e.target.value })}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                        placeholder="Feature description"
                      />
                    </div>
                    <button
                      onClick={() => deleteFeature(idx)}
                      className="text-red-400 hover:text-red-600 p-1 mt-1"
                      aria-label="Delete feature"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xl leading-none flex-shrink-0">{f.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{f.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{f.description}</div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          {editMode && (
            <div className="px-4 pb-4 pt-2">
              <button
                onClick={addFeature}
                className="w-full text-sm text-pink-500 font-semibold border-2 border-dashed border-pink-200 rounded-xl py-2 active:bg-pink-50 transition-colors"
              >
                + Add feature
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contact */}
      {editMode ? (
        <input
          value={content.contactEmail ?? ''}
          onChange={e => onChange({ ...content, contactEmail: e.target.value })}
          type="email"
          placeholder="Contact email (optional)"
          className="w-full text-sm border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-400"
        />
      ) : content.contactEmail ? (
        <div className="bg-gray-50 rounded-2xl p-4 text-center">
          <p className="text-sm text-gray-500">Get in touch</p>
          <a href={`mailto:${content.contactEmail}`} className="text-sm font-semibold text-pink-600 mt-1 block">
            {content.contactEmail}
          </a>
        </div>
      ) : null}
    </div>
  );
}
