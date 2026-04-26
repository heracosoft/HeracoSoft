/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from '../lib/supabaseClient';
import { 
  UserPlus, 
  X, 
  Phone, 
  DollarSign, 
  Trash2,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Search,
  Pencil,
  UserCheck 
} from 'lucide-react';

interface Lead {
  id: string;
  nombre_prospecto: string;
  empresa: string;
  telefono: string;
  interes: string;
  estado: string;
  valor_estimado: number;
  notas: string;
}

const ESTADOS_VENTA = ['Nuevo', 'Contactado', 'Propuesta', 'Negociación'];

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const [nuevoLead, setNuevoLead] = useState({
    nombre_prospecto: '',
    empresa: '',
    telefono: '',
    interes: '',
    estado: 'Nuevo',
    valor_estimado: 0,
    notas: ''
  });

  const traerLeads = useCallback(async () => {
    try {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (data) setLeads(data as Lead[]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    let montado = true;
    const inicializar = async () => {
      if (montado) {
        await traerLeads();
      }
    };
    inicializar();
    return () => { montado = false; };
  }, [traerLeads]);

  const prepararEdicion = (l: Lead) => {
    setNuevoLead({
      nombre_prospecto: l.nombre_prospecto,
      empresa: l.empresa || '',
      telefono: l.telefono || '',
      interes: l.interes || '',
      estado: l.estado,
      valor_estimado: l.valor_estimado,
      notas: l.notas || ''
    });
    setIdEditando(l.id);
    setMostrarForm(true);
  };

  const guardarLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (idEditando) {
      await supabase.from('leads').update(nuevoLead).eq('id', idEditando);
    } else {
      await supabase.from('leads').insert([nuevoLead]);
    }
    setMostrarForm(false);
    setIdEditando(null);
    setNuevoLead({ nombre_prospecto: '', empresa: '', telefono: '', interes: '', estado: 'Nuevo', valor_estimado: 0, notas: '' });
    traerLeads();
  };

  const convertirACliente = async (l: Lead) => {
    if (!window.confirm(`¿Convertir a ${l.nombre_prospecto} en Cliente oficial?`)) return;

    const { data: nuevoCliente, error } = await supabase
      .from('clientes')
      .insert([{
        empresa: l.empresa || l.nombre_prospecto,
        nombre_contacto: l.nombre_prospecto,
        telefono: l.telefono,
        email: '' 
      }])
      .select()
      .single();

    if (!error && nuevoCliente) {
      await supabase.from('leads').delete().eq('id', l.id);
      navigate('/clientes', { state: { editarId: nuevoCliente.id } });
    } else {
      alert("Error al convertir: " + error?.message);
    }
  };

  const moverLead = async (id: string, nuevoEstado: string) => {
    await supabase.from('leads').update({ estado: nuevoEstado }).eq('id', id);
    traerLeads();
  };

  const eliminarLead = async (id: string) => {
    if (window.confirm("¿Archivar este prospecto?")) {
      await supabase.from('leads').delete().eq('id', id);
      traerLeads();
    }
  };

  if (cargando) return <div className="h-screen bg-black flex items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-heraco border-t-transparent"></div></div>;

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white">
      
      {/* 🟢 CABECERA RESPONSIVA */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic">Prospectos</h1>
          <p className="text-heraco font-bold text-xs md:text-sm tracking-widest uppercase italic">Funnel de Ventas</p>
        </div>
        <button onClick={() => { setIdEditando(null); setMostrarForm(true); }} className="w-full md:w-auto bg-heraco text-black font-extrabold py-3 px-6 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg text-xs">
          <UserPlus size={18} /> NUEVO LEAD
        </button>
      </header>

      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
        <input type="text" placeholder="Buscar prospecto..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 pl-12 focus:border-heraco outline-none text-white text-sm" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {/* 🟢 CONTENEDOR KANBAN RESPONSIVO */}
      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-10 custom-scrollbar -mx-4 px-4 md:mx-0 md:px-0 snap-x">
        {ESTADOS_VENTA.map((columna) => (
          <div key={columna} className="min-w-[85vw] md:min-w-[320px] flex-1 snap-center">
            <div className="bg-zinc-900/50 p-4 rounded-2xl md:rounded-3xl border border-zinc-800 mb-6 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
              <h2 className="font-black uppercase italic text-[10px] md:text-xs tracking-widest text-zinc-400">{columna}</h2>
              <span className="bg-heraco text-black text-[10px] font-black px-2 py-0.5 rounded-full">{leads.filter(l => l.estado === columna).length}</span>
            </div>

            <div className="space-y-4">
              {leads.filter(l => l.estado === columna && (l.nombre_prospecto.toLowerCase().includes(busqueda.toLowerCase()) || l.empresa?.toLowerCase().includes(busqueda.toLowerCase())))
                .map((l) => (
                  <div key={l.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl md:rounded-4xl hover:border-heraco/40 transition-all group relative">
                    <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => prepararEdicion(l)} className="text-zinc-500 hover:text-heraco p-1"><Pencil size={14} /></button>
                      <button onClick={() => eliminarLead(l.id)} className="text-zinc-500 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                    </div>

                    <div className="mb-4 pr-12">
                      <h3 className="font-bold text-base md:text-lg leading-tight mb-1 group-hover:text-heraco transition-colors truncate">{l.nombre_prospecto}</h3>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-tight truncate">{l.empresa || 'Particular'}</p>
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-zinc-400"><MessageSquare size={12} className="text-heraco shrink-0" /><span className="text-xs italic line-clamp-2">{l.interes}</span></div>
                      <div className="flex items-center gap-2 text-zinc-400"><Phone size={12} className="shrink-0" /><span className="text-xs">{l.telefono || 'Sin tel.'}</span></div>
                    </div>

                    <div className="flex justify-between items-center border-t border-zinc-800 pt-4">
                      <div className="flex gap-2">
                        <button onClick={() => moverLead(l.id, ESTADOS_VENTA[ESTADOS_VENTA.indexOf(columna) - 1])} disabled={ESTADOS_VENTA.indexOf(columna) === 0} className="p-2 bg-black border border-zinc-800 rounded-lg hover:text-heraco disabled:opacity-20"><ChevronLeft size={18}/></button>
                        <button onClick={() => moverLead(l.id, ESTADOS_VENTA[ESTADOS_VENTA.indexOf(columna) + 1])} disabled={ESTADOS_VENTA.indexOf(columna) === ESTADOS_VENTA.length - 1} className="p-2 bg-black border border-zinc-800 rounded-lg hover:text-heraco disabled:opacity-20"><ChevronRight size={18}/></button>
                      </div>
                      
                      <button 
                        onClick={() => convertirACliente(l)}
                        className="bg-heraco/10 text-heraco hover:bg-heraco hover:text-black border border-heraco/20 p-2.5 rounded-xl transition-all"
                        title="Venta concretada"
                      >
                        <UserCheck size={18} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* 🟢 MODAL FORMULARIO RESPONSIVO */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setMostrarForm(false)} 
              className="absolute top-6 right-6 text-zinc-500 hover:text-white bg-black p-2 rounded-full border border-zinc-800"
            >
              <X size={20} />
            </button>

            <h2 className="text-2xl font-black uppercase text-heraco italic mb-6">{idEditando ? 'Editar Prospecto' : 'Nuevo Prospecto'}</h2>
            <form onSubmit={guardarLead} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-1 block tracking-widest">Contacto</label>
                <input required placeholder="Nombre completo" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl focus:border-heraco outline-none font-bold text-sm text-white" value={nuevoLead.nombre_prospecto} onChange={e => setNuevoLead({...nuevoLead, nombre_prospecto: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-1 block tracking-widest">Empresa</label>
                  <input placeholder="Nombre empresa" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl focus:border-heraco outline-none font-bold text-sm text-white" value={nuevoLead.empresa} onChange={e => setNuevoLead({...nuevoLead, empresa: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-1 block tracking-widest">Teléfono</label>
                  <input placeholder="WhatsApp" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl focus:border-heraco outline-none font-bold text-sm text-white" value={nuevoLead.telefono} onChange={e => setNuevoLead({...nuevoLead, telefono: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-1 block tracking-widest">¿Qué busca?</label>
                <input placeholder="Interés o producto" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl focus:border-heraco outline-none font-bold text-sm text-white" value={nuevoLead.interes} onChange={e => setNuevoLead({...nuevoLead, interes: e.target.value})} />
              </div>

              <div className="bg-black border border-zinc-800 p-4 rounded-2xl">
                <label className="text-[10px] font-black text-zinc-500 uppercase block mb-1">Presupuesto Estimado</label>
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-heraco" />
                  <input type="number" className="w-full bg-transparent focus:outline-none font-black text-xl text-white" value={nuevoLead.valor_estimado} onChange={e => setNuevoLead({...nuevoLead, valor_estimado: parseFloat(e.target.value) || 0})} />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setMostrarForm(false)} className="flex-1 text-zinc-500 font-black uppercase text-xs tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 bg-heraco text-black font-black py-4 rounded-2xl uppercase shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-xs tracking-widest">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}