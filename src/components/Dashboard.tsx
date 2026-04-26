import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { 
  MessageSquare, 
  Calendar, 
  BarChart3, 
  Users, 
  FileText, 
  CheckCircle, 
  Plus, 
  Send, 
  Trash2, 
  Pencil, 
  X, 
  TrendingUp,
  Clock,
  ShoppingCart,
  Shield,
  Briefcase,
  Package
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Nota {
  id: string;
  nombre: string;
  created_at?: string;
}

interface Tarea {
  id: string;
  titulo: string;
  cliente: string;
  prioridad: string;
  fecha_limite: string;
  id_asignado: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  // Simulación temporal para la gráfica visual de carga (puedes conectarla a datos reales después)
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const cargaTrabajo = [40, 80, 50, 90, 30, 10, 5];

  const [textoNota, setTextoNota] = useState('');
  const [notasDb, setNotasDb] = useState<Nota[]>([]);
  const [idEditando, setIdEditando] = useState<string | null>(null);
  
  const [sesion, setSesion] = useState<any>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]); 

  const [stats, setStats] = useState({
    clientes: 0,
    proyectos: 0,
    cotizaciones: 0,
    leads: 0,
    ventasProyectadas: 0
  });

  const traerTodo = useCallback(async () => {
    // 1. Cargar Notas
    const { data: notas } = await supabase.from('notas').select('*').order('created_at', { ascending: false });
    if (notas) setNotasDb(notas as Nota[]);

    // 2. Cargar Estadísticas Reales
    const { count: clis } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
    // Proyectos que no estén en estado 'Entregado' o 'Listo' (Ajusta los estados según tu lógica en proyectos)
    const { count: proys } = await supabase.from('proyectos').select('*', { count: 'exact', head: true }).neq('estado', 'Entregado');
    const { count: cots } = await supabase.from('cotizaciones').select('*', { count: 'exact', head: true }).eq('estado', 'Pendiente');
    const { data: leadsData } = await supabase.from('leads').select('valor_estimado');

    setStats({
      clientes: clis || 0,
      proyectos: proys || 0,
      cotizaciones: cots || 0,
      leads: leadsData?.length || 0,
      ventasProyectadas: leadsData?.reduce((acc, curr) => acc + Number(curr.valor_estimado), 0) || 0
    });

    // 3. Cargar Sesión y Tareas (Deadlines)
    const s = localStorage.getItem('heraco_session');
    if (s) {
      const sesionActual = JSON.parse(s);
      setSesion(sesionActual);

      const esAdmin = String(sesionActual.rol).toLowerCase() === 'admin';

      // Consulta a la tabla 'tareas' (Asegúrate de crearla en Supabase)
      let query = supabase.from('tareas').select('*').eq('estado', 'activa').order('fecha_limite', { ascending: true });

      // Filtro de seguridad: Si no es admin, solo ve sus tareas
      if (!esAdmin) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) query = query.eq('id_asignado', user.id);
      }

      const { data: tareasData, error: errTareas } = await query;
      if (!errTareas && tareasData) {
        setTareas(tareasData as Tarea[]);
      } else {
        console.warn("No se pudo cargar 'tareas'. ¿Existe la tabla en Supabase?", errTareas);
      }
    }
  }, []);

  useEffect(() => {
    let montado = true;
    const inicializar = async () => { if (montado) await traerTodo(); };
    inicializar();
    return () => { montado = false; };
  }, [traerTodo]);

  const manejarGuardar = async () => {
    if (!textoNota) return;
    if (idEditando) {
      await supabase.from('notas').update({ nombre: textoNota }).eq('id', idEditando);
      setIdEditando(null);
    } else {
      await supabase.from('notas').insert([{ nombre: textoNota }]);
    }
    setTextoNota('');
    await traerTodo();
  };

  const eliminarNota = async (id: string) => {
    if (window.confirm("¿Borrar esta nota?")) {
      await supabase.from('notas').delete().eq('id', id);
      await traerTodo();
    }
  };

  const prepararEdicion = (nota: Nota) => {
    setTextoNota(nota.nombre);
    setIdEditando(nota.id);
  };

  // --- CONTROL DE ACCESOS PARA LOS BOTONES ---
  const esAdminParaTarjetas = !sesion || String(sesion.rol).toLowerCase() === 'admin';
  const tienePermiso = (modulo: string) => esAdminParaTarjetas || (sesion?.permisos?.[modulo] && sesion.permisos[modulo] !== 'ninguno');

  const formatearFecha = (fechaStr: string) => {
    const fecha = new Date(fechaStr);
    const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return {
      dia: fecha.getDate().toString().padStart(2, '0'),
      mes: meses[fecha.getMonth()]
    };
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Dashboard</h1>
          <p className="text-heraco text-sm uppercase tracking-widest font-bold">Heraco Agency Command</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {tienePermiso('caja') && ( // Asumiendo que 'caja' o similar es el permiso, ajusta si es necesario
             <button onClick={() => navigate('/caja')} className="bg-heraco text-black font-black py-3 px-6 rounded-2xl flex items-center gap-2 hover:scale-[1.02] transition-all shadow-lg text-xs tracking-widest uppercase">
               <ShoppingCart size={18} /> PUNTO DE VENTA
             </button>
          )}
          {tienePermiso('proyectos') && (
            <button onClick={() => navigate('/cotizaciones')} className="bg-zinc-900 border border-zinc-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 hover:bg-zinc-800 transition-all text-xs">
              <Plus size={18} /> Nuevo Proyecto
            </button>
          )}
        </div>
      </header>

      {/* --- NUEVO: BOTONERA DE ACCESO RÁPIDO (REEMPLAZA AL SIDEBAR PARA ESTOS MÓDULOS) --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {tienePermiso('equipo') && (
          <button onClick={() => navigate('/usuarios')} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-heraco/50 hover:bg-zinc-800/50 transition-all group">
             <Shield className="text-zinc-500 group-hover:text-heraco transition-colors" size={24} />
             <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400 group-hover:text-white">Equipo</span>
          </button>
        )}
        {tienePermiso('clientes') && (
          <button onClick={() => navigate('/clientes')} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-heraco/50 hover:bg-zinc-800/50 transition-all group">
             <Users className="text-zinc-500 group-hover:text-heraco transition-colors" size={24} />
             <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400 group-hover:text-white">Clientes</span>
          </button>
        )}
        {tienePermiso('catalogo') && (
          <button onClick={() => navigate('/servicios')} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-heraco/50 hover:bg-zinc-800/50 transition-all group">
             <Briefcase className="text-zinc-500 group-hover:text-heraco transition-colors" size={24} />
             <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400 group-hover:text-white">Catálogo</span>
          </button>
        )}
        {tienePermiso('materiales') && (
          <button onClick={() => navigate('/materiales')} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-heraco/50 hover:bg-zinc-800/50 transition-all group">
             <Package className="text-zinc-500 group-hover:text-heraco transition-colors" size={24} />
             <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400 group-hover:text-white">Materiales</span>
          </button>
        )}
      </div>

      {/* --- ESTADÍSTICAS PRINCIPALES --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {tienePermiso('clientes') && (
          <div onClick={() => navigate('/clientes')} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-heraco/50 transition-all cursor-pointer">
            <div className="flex justify-between items-center mb-4">
              <Users className="text-heraco" size={24} />
              <span className="text-3xl font-black italic tracking-tighter">{stats.clientes}</span>
            </div>
            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Clientes Totales</p>
          </div>
        )}
        {tienePermiso('proyectos') && (
          <div onClick={() => navigate('/proyectos')} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-heraco/50 transition-all cursor-pointer">
            <div className="flex justify-between items-center mb-4">
              <CheckCircle className="text-heraco" size={24} />
              <span className="text-3xl font-black italic tracking-tighter">{stats.proyectos}</span>
            </div>
            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Proyectos Activos</p>
          </div>
        )}
        {tienePermiso('cotizaciones') && (
          <div onClick={() => navigate('/cotizaciones')} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-heraco/50 transition-all cursor-pointer">
            <div className="flex justify-between items-center mb-4">
              <FileText className="text-heraco" size={24} />
              <span className="text-3xl font-black italic tracking-tighter">{stats.cotizaciones}</span>
            </div>
            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Cotiz. Pendientes</p>
          </div>
        )}
        {tienePermiso('prospectos') && (
          <div onClick={() => navigate('/leads')} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-heraco/50 transition-all cursor-pointer">
            <div className="flex justify-between items-center mb-4">
              <TrendingUp className="text-heraco" size={24} />
              <span className="text-3xl font-black italic tracking-tighter">{stats.leads}</span>
            </div>
            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Prospectos Activos</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* NOTAS */}
        <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-2xl flex flex-col h-[450px]">
          <div className="flex justify-between items-center mb-6 text-heraco shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={20} />
              <h2 className="font-bold uppercase text-sm tracking-wider">{idEditando ? "Editando Nota" : "Notas Rápidas"}</h2>
            </div>
            {idEditando && <button onClick={() => { setIdEditando(null); setTextoNota(''); }} className="text-zinc-500 hover:text-white"><X size={16} /></button>}
          </div>
          <div className="relative shrink-0">
            <textarea value={textoNota} onChange={(e) => setTextoNota(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm focus:border-heraco outline-none mb-4 transition-all text-white resize-none" placeholder="Idea brillante..." rows={3} />
            <button onClick={manejarGuardar} className="absolute bottom-8 right-4 bg-heraco text-black p-2 rounded-lg hover:scale-110 transition-all"><Send size={16} /></button>
          </div>
          <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
            {notasDb.map((n) => (
              <div key={n.id} className="group bg-black p-3 rounded-lg text-xs border-l-2 border-heraco text-zinc-300 flex justify-between items-start">
                <span className="flex-1 mr-2 leading-relaxed">{n.nombre}</span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => prepararEdicion(n)} className="text-zinc-500 hover:text-heraco"><Pencil size={14} /></button>
                  <button onClick={() => eliminarNota(n.id)} className="text-zinc-500 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARGA SEMANAL (Simulada por ahora) */}
        <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-2xl flex flex-col h-[450px]">
          <div className="flex items-center gap-2 mb-10 text-heraco shrink-0"><BarChart3 size={20} /><h2 className="font-bold uppercase text-sm tracking-wider">Carga Semanal</h2></div>
          <div className="flex items-end justify-between flex-1 px-2 gap-2 mb-4">
            {cargaTrabajo.map((p, i) => (
              <div key={i} className="w-full bg-zinc-800 rounded-full h-full relative overflow-hidden flex flex-col justify-end group">
                <div className="w-full bg-heraco transition-all duration-500 ease-in-out group-hover:bg-white" style={{ height: `${p}%` }}></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between px-1 shrink-0">{dias.map(d => <span key={d} className="text-[10px] text-zinc-600 font-bold uppercase">{d}</span>)}</div>
        </div>

        {/* DEADLINE HERACO (Tareas reales) */}
        <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-2xl flex flex-col h-[450px]">
          <div className="flex items-center gap-2 mb-6 text-heraco shrink-0">
            <Calendar size={20} />
            <h2 className="font-bold uppercase text-sm tracking-wider">Deadline Heraco</h2>
          </div>
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 custom-scrollbar">
            {tareas.map((tarea) => {
              const { dia, mes } = formatearFecha(tarea.fecha_limite);
              return (
                <div key={tarea.id} className="flex items-center gap-4 bg-black/50 p-3 rounded-xl border border-zinc-800/50 hover:border-heraco/30 transition-all group">
                  <div className={`text-center p-2 rounded-lg min-w-[50px] transition-colors ${tarea.prioridad === 'Urgente' ? 'bg-red-500 text-white group-hover:bg-red-600' : 'bg-heraco text-black group-hover:bg-[#d4e626]'}`}>
                    <p className="text-[9px] font-black">{mes}</p>
                    <p className="text-lg font-black leading-none">{dia}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-white">{tarea.titulo}</p>
                    <div className="flex items-center gap-1.5 opacity-70 mt-1">
                       <Clock size={10} className="text-heraco shrink-0" />
                       <p className="text-[10px] text-heraco uppercase font-bold truncate">{tarea.cliente} • {tarea.prioridad}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {tareas.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30">
                <Calendar size={48} className="mb-4" />
                <p className="text-xs uppercase font-black italic">Sin entregas próximas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}