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
      {/* pb-24 deja espacio suficiente para que el BottomNav no tape el contenido */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 pb-24">{children}</main>
      <BottomNav rol={profile?.role} />
    </div>
  );
}
