import { useState, useEffect } from 'react'; 
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  CheckCircle, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Briefcase, 
  Package,
  TrendingUp,
  Shield, 
  MapPin,
  User as UserIcon // Renombrado para evitar conflicto con tipos
} from 'lucide-react'; 

interface SidebarProps {
  onLogout: () => void;
  rol: string; 
  permisos?: any; 
}

export default function Sidebar({ onLogout, rol, permisos }: SidebarProps) {
  const [expandido, setExpandido] = useState(true);
  const [nombreUsuario, setNombreUsuario] = useState<string>('Cargando...');

  // --- LÓGICA: Buscar el nombre del usuario logeado ---
  useEffect(() => {
    const traerNombreUsuario = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      
      if (user) {
        const { data } = await supabase.from('perfiles').select('nombre').eq('id', user.id).single();
        if (data && data.nombre) {
          setNombreUsuario(data.nombre);
        } else {
          setNombreUsuario('Usuario Heraco');
        }
      }
    };
    traerNombreUsuario();
  }, []);

  const menuCompleto = [
    { nombre: 'Dashboard', ruta: '/', icono: LayoutDashboard, id: 'dashboard' },
    { nombre: 'Prospectos', ruta: '/leads', icono: TrendingUp, id: 'prospectos' },
    { nombre: 'Clientes', ruta: '/clientes', icono: Users, id: 'clientes' },
    { nombre: 'Catálogo', ruta: '/servicios', icono: Briefcase, id: 'catalogo' },
    { nombre: 'Materiales', ruta: '/materiales', icono: Package, id: 'materiales' },
    { nombre: 'Proyectos', ruta: '/proyectos', icono: CheckCircle, id: 'proyectos' },
    { nombre: 'Cotizaciones', ruta: '/cotizaciones', icono: FileText, id: 'cotizaciones' },
    { nombre: 'Equipo', ruta: '/usuarios', icono: Shield, id: 'equipo' },   
    { nombre: 'Entregas', ruta: '/entregas', icono: MapPin, id: 'entregas' }, 
  ];

  // --- FILTRO DE SEGURIDAD REFORZADO ---
  const menuFiltrado = menuCompleto.filter(item => {
    // 1. Si eres Admin, entras a todo (Convertimos a string por si viene null/undefined)
    const rolActual = String(rol || '').toLowerCase();
    if (rolActual === 'admin' || rolActual === 'administrador') return true;

    // 2. Si no hay permisos cargados aún, solo mostramos Dashboard
    if (!permisos) {
      return item.id === 'dashboard';
    }

    // 3. Revisamos permisos específicos (Usamos casting 'as any' para Vercel)
    const nivelAcceso = (permisos as any)[item.id] || 'ninguno';
    return nivelAcceso !== 'ninguno';
  });

  return (
    <aside className={`bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen sticky top-0 font-sans transition-all duration-300 ${expandido ? 'w-64' : 'w-20'}`}>
      
      <button 
        onClick={() => setExpandido(!expandido)}
        className="absolute -right-3 top-10 bg-heraco text-black rounded-full p-1 border border-zinc-800 z-10 hover:scale-110 transition-transform shadow-lg"
      >
        {expandido ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className="p-6 border-b border-zinc-800 flex justify-center items-center h-26 overflow-hidden">
        {expandido ? (
          <img 
            src="/Verde.svg" 
            alt="Heraco Logo" 
            className="w-48 object-contain transition-transform hover:scale-105 min-w-30" 
          />
        ) : (
          <h1 className="text-3xl font-black text-heraco tracking-tighter">H</h1>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {menuFiltrado.map((item) => (
          <NavLink
            key={item.nombre}
            to={item.ruta}
            title={!expandido ? item.nombre : ""} 
            className={({ isActive }) =>
              `flex items-center p-3 rounded-xl transition-all font-semibold ${
                expandido ? 'gap-3 justify-start' : 'justify-center'
              } ${
                isActive 
                  ? 'bg-heraco text-black shadow-lg shadow-heraco/20' 
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`
            }
          >
            <item.icono size={20} className="min-w-5" />
            {expandido && <span className="whitespace-nowrap">{item.nombre}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800 overflow-hidden flex flex-col gap-3">
        
        {/* --- INFORMACIÓN DEL USUARIO --- */}
        <div className={`flex items-center ${expandido ? 'gap-3 px-2' : 'justify-center'} text-zinc-300`}>
          <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
            <UserIcon size={16} className="text-heraco" />
          </div>
          {expandido && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold truncate w-full text-white leading-tight">
                {nombreUsuario}
              </span>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest truncate w-full">
                {rol}
              </span>
            </div>
          )}
        </div>

        {/* BOTÓN DE SALIR */}
        <button 
          onClick={onLogout}
          title={!expandido ? "Salir" : ""}
          className={`flex items-center p-3 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 w-full rounded-xl transition-all font-semibold ${
            expandido ? 'gap-3 justify-start' : 'justify-center'
          }`}
        >
          <LogOut size={20} className="min-w-5" />
          {expandido && <span className="whitespace-nowrap">Salir</span>}
        </button>
      </div>

    </aside>
  );
}