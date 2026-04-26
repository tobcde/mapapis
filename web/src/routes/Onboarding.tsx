import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useUpdateProfile } from '@/lib/mutations/useUpdateProfile';
import type { ProfileRole } from '@/lib/database.types';

const schema = z.object({
  nombre: z.string().trim().min(2, 'Tu nombre o apodo'),
  role: z.enum(['familia', 'pyme'], { message: 'Elegi un rol' }),
});

type FormValues = z.infer<typeof schema>;

const roles: { value: Extract<ProfileRole, 'familia' | 'pyme'>; titulo: string; sub: string }[] = [
  { value: 'familia', titulo: 'Soy familia', sub: 'Coordino compras del jardin/colegio con otros padres' },
  { value: 'pyme', titulo: 'Soy pyme', sub: 'Vendo productos a grupos de padres' },
];

export function Onboarding() {
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '' },
  });

  const selectedRole = watch('role');

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setErrorMsg(null);
    try {
      await updateProfile.mutateAsync({ nombre: values.nombre, role: values.role });
      void navigate('/home', { replace: true });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo guardar tu perfil');
    }
  };

  return (
    <main className="min-h-screen px-6 py-12 flex flex-col items-center justify-center max-w-md mx-auto">
      <div
        className="bg-white rounded-3xl border-[1.5px] border-ink p-8 w-full"
        style={{ boxShadow: 'var(--shadow-pop)' }}
      >
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-coral">Bienvenida</div>
        <h1 className="font-display font-black text-5xl leading-none mt-3">
          ¿Quién <span className="font-display-italic">sos</span>?
        </h1>
        <p className="text-ink/70 mt-3 text-[15px]">Contanos cómo vas a usar MaPaPis.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-ink/70">Nombre o apodo</label>
            <input
              type="text"
              placeholder="Ej. Pablo / Mama de Mateo"
              {...register('nombre')}
              className="mt-1 w-full rounded-xl border-[1.5px] border-ink/30 px-4 py-3 text-sm focus:outline-none focus:border-ink"
            />
            {errors.nombre && <p className="text-[11px] text-coral mt-1">{errors.nombre.message}</p>}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-ink/70">Como vas a usar MaPaPis</label>
            <div className="mt-2 grid gap-2">
              {roles.map((r) => {
                const active = selectedRole === r.value;
                return (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => { setValue('role', r.value, { shouldValidate: true }); }}
                    className={`text-left rounded-xl border-[1.5px] px-4 py-3 transition ${
                      active ? 'border-ink bg-sun/30' : 'border-ink/20 bg-white hover:border-ink/50'
                    }`}
                  >
                    <div className="font-bold text-sm">{r.titulo}</div>
                    <div className="text-[11px] text-ink/60 mt-0.5">{r.sub}</div>
                  </button>
                );
              })}
            </div>
            {errors.role && <p className="text-[11px] text-coral mt-1">{errors.role.message}</p>}
          </div>

          {errorMsg && (
            <p className="text-[11px] text-coral bg-coral/10 rounded-lg px-3 py-2">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-pop py-3 bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'Guardando...' : 'Continuar →'}
          </button>
        </form>
      </div>
    </main>
  );
}
