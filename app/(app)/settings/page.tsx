import { pageUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { SettingsForm } from './settings-form';

export const metadata = { title: 'Settings · HeyToolie' };

export default async function SettingsPage() {
  const user = await pageUser('/settings');
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted">{user.email}</p>
      <SettingsForm
        initial={{ level: user.level, tone: user.tone, display_name: user.display_name, smart_model: user.smart_model }}
        defaultModel={env().GEMINI_MODEL_PRO}
      />
    </div>
  );
}
