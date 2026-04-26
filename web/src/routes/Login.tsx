import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';

const schema = z.object({
  email: z.string().email('Email inválido'),
});

type FormValues = z.infer<typeof schema>;

export function Login() {
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const session = useSessionStore((s) => s.session);
  const sessionLoading = useSessionStore((s) => s.loading);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  if (!sessionLoading && session) {
    return <Navigate to="/home" replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <main className="min-h-screen px-6 py-12 flex flex-col items-center justify-center max-w-md mx-auto">
      <div
        className="bg-white rounded-3xl border-[1.5px] border-ink p-8 w-full"
        style={{ boxShadow: 'var(--shadow-pop)' }}
      >
        <Link to="/" className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
          ← Volver
        </Link>
        <h2 className="font-display font-extrabold text-2xl mt-3">Iniciar sesión</h2>
        <p className="text-xs text-ink/60 mt-1">Te mandamos un link mágico al mail.</p>

        {sent ? (
          <div className="mt-6 bg-sage/15 border-[1.5px] border-sage rounded-xl p-4 text-sm">
            ✓ Listo. Revisá tu mail y clickeá el link para entrar.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink/70">Email</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="vos@gmail.com"
                {...register('email')}
                className="mt-1 w-full rounded-xl border-[1.5px] border-ink/30 px-4 py-3 text-sm focus:outline-none focus:border-ink"
              />
              {errors.email && (
                <p className="text-[11px] text-coral mt-1">{errors.email.message}</p>
              )}
            </div>

            {errorMsg && (
              <p className="text-[11px] text-coral bg-coral/10 rounded-lg px-3 py-2">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-pop py-3 bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar link →'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
