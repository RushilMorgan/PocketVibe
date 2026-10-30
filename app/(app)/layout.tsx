import { TabBar } from '@/components/tab-bar';

/** Signed-in app shell. Each page gates itself with pageUser() so it can return there after sign-in. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-24">{children}</div>
      <TabBar />
    </>
  );
}
