import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Lock, User, Eye, EyeOff } from 'lucide-react';

// 1. Definimos la Interface para que App.tsx reconozca onLogin (ahora incluye permisos)
interface LoginProps {
  onLogin: (data: { user: string; rol: string; permisos?: any }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError('');

    // --- EL TRUCO HERACO CORREGIDO ---
    // Cambiamos @heraco.app por @heracosoft.mx para coincidir con tu Supabase
    const emailVirtual = `${usuario.toLowerCase().trim()}@heracosoft.mx`;

    // 2. Intentamos iniciar sesión en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailVirtual,
      password: password,
    });

    if (authError) {
      setError('Acceso denegado: Usuario o contraseña incorrectos.');
      setCargando(false);
      return;
    }

    // 3. Si tuvo éxito, buscamos el ROL y los PERMISOS en la tabla de perfiles
    const { data: perfilData, error: perfilError } = await supabase
      .from('perfiles')
      .select('rol, permisos') // <-- CAMBIO AQUÍ: Pedimos también los permisos
      .eq('id', authData.user.id)
      .single();

    if (perfilError || !perfilData) {
      setError('Error al obtener el perfil de usuario en la tabla perfiles.');
      setCargando(false);
      return;
    }

    // 4. Preparamos los datos de sesión con la nueva "mochila"
    const userData = { 
      user: usuario.toUpperCase(), 
      rol: perfilData.rol,
      permisos: perfilData.permisos // <-- CAMBIO AQUÍ: Guardamos los permisos
    };

    // 5. Guardamos en localStorage y avisamos a App.tsx
    localStorage.setItem('heraco_session', JSON.stringify(userData));
    onLogin(userData);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img src="/Verde.svg" alt="Heraco Logo" className="w-64 mx-auto mb-6" />
          <h2 className="text-heraco text-[10px] font-black uppercase tracking-[0.3em] italic">
            Command Center Login
          </h2>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-4 mb-2 block tracking-widest">
                Usuario
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  type="text"
                  required
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-heraco outline-none transition-all font-bold uppercase"
                  placeholder="Escribe tu usuario"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-4 mb-2 block tracking-widest">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input
                  type={verPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl py-4 pl-12 pr-12 text-white focus:border-heraco outline-none transition-all font-bold"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword(!verPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-heraco"
                >
                  {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-[10px] font-black uppercase text-center italic animate-pulse">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-heraco text-black font-black py-5 rounded-2xl uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {cargando ? 'Iniciando...' : 'Entrar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}