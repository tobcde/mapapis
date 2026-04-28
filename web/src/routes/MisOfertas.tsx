import { Shell } from '@/components/Shell';
import { SkeletonList } from '@/components/ui';

export function MisOfertas() {
  return (
    <Shell>
      <div className="anim-in space-y-4">
        <h1 className="font-display font-black text-[2.6rem] leading-[0.95]">
          Mis <span className="font-display-italic">ofertas</span>
        </h1>
        <p className="text-sm text-ink/60">
          Tus ofertas presentadas a familias aparecerán acá. — Fase 4
        </p>
        <SkeletonList count={2} />
      </div>
    </Shell>
  );
}
