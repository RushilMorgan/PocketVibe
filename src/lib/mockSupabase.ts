import type { SiteConfig } from '../types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface SaveSiteResult {
  success: boolean;
  subdomain: string;
  userId: string;
}

export async function saveSite(config: SiteConfig, email: string): Promise<SaveSiteResult> {
  const payload = {
    table: 'user_sites',
    data: {
      email,
      site_config: {
        businessName: config.businessName,
        businessDescription: config.businessDescription,
        theme: config.theme,
        headline: config.headline,
        subheadline: config.subheadline,
        ctaText: config.ctaText,
      },
      subdomain: config.subdomain,
      status: 'live',
      created_at: new Date().toISOString(),
    },
  };

  console.log('[Supabase mock] INSERT INTO user_sites →', JSON.stringify(payload, null, 2));

  await delay(1500);

  const userId = `usr_${Math.random().toString(36).slice(2, 10)}`;

  console.log(
    `[Supabase mock] ✅ Site saved. User ID: ${userId} | Live at: https://${config.subdomain}`,
  );

  return { success: true, subdomain: config.subdomain, userId };
}
