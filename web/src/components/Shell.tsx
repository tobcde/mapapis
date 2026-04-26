import { type ReactNode } from 'react';
import { useProfile } from '@/lib/queries/useProfile';
import { BottomNav } from '@/components/BottomNav';
import { PendingJoinHandler } from '@/components/PendingJoinHandler';

interface Props {
  children: ReactNode;
}

export function Shell({ children }: Props) {
  const { data: profile } = useProfile();

  return (
    <div className="min-h-screen flex flex-col">
      <PendingJoinHandler />
      {/* pb-28 deja espacio para la píldora flotante (44px píldora + 12px padding bottom + margen) */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 pb-28">{children}</main>
      <BottomNav rol={profile?.role} />
    </div>
  );
}
