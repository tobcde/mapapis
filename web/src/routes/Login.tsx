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

  const onGoogle = async () => {
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    if (error) {
      setErrorMsg(error.message);
    }
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
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => { void onGoogle(); }}
              className="btn-pop py-3 bg-white text-ink font-extrabold rounded-xl border-[1.5px] border-ink uppercase tracking-wider text-xs flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3c-2 1.4-4.6 2.3-7.4 2.3-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.3 5.3C40.7 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Entrar con Google
            </button>

            <div className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-ink/20" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">o por email</span>
              <div className="flex-1 h-px bg-ink/20" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-pop py-3 bg-ink text-sun font-extrabold rounded-xl uppercase tracking-wider text-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar link →'}
              </button>
            </form>

            {errorMsg && (
              <p className="text-[11px] text-coral bg-coral/10 rounded-lg px-3 py-2">{errorMsg}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
