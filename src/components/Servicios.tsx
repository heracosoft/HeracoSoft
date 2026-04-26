/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, Trash2, Search, X, Pencil, DollarSign, Tag, Settings, ListChecks } from 'lucide-react';

interface Categoria {
  id: string;
  nombre: string;
}

interface Servicio {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio_base: number;
  procesos?: string[]; 
}

export default function Servicios() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busqueda, setBusqueda] = useState('');
  
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarModalCategorias, setMostrarModalCategorias] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);

  const [nuevaCategoriaText, setNuevaCategoriaText] = useState('');
  const [nuevoProcesoText, setNuevoProcesoText] = useState(''); 
  
  const [nuevo, setNuevo] = useState<{
    nombre: string;
    descripcion: string;
    categoria: string;
    precio_base: number;
    procesos: string[]; 
  }>({
    nombre: '',
    descripcion: '',
    categoria: '',
    precio_base: 0,
    procesos: []
  });

  useEffect(() => {
    let montado = true;
    const traerDatos = async () => {
      const { data: dataServicios } = await supabase.from('servicios').select('*').order('categoria', { ascending: true });
      const { data: dataCategorias } = await supabase.from('categorias_servicio').select('*').order('created_at', { ascending: true });
      
      if (montado) {
        if (dataServicios) setServicios(dataServicios as Servicio[]);
        if (dataCategorias) {
          setCategorias(dataCategorias as Categoria[]);
          if (dataCategorias.length > 0 && !idEditando) {
            setNuevo(prev => ({ ...prev, categoria: dataCategorias[0].nombre }));
          }
        }
      }
    };
    traerDatos();
    return () => { montado = false; };
  }, [idEditando]);

  const recargarServicios = async () => {
    const { data } = await supabase.from('servicios').select('*').order('categoria', { ascending: true });
    if (data) setServicios(data as Servicio[]);
  };

  const recargarCategorias = async () => {
    const { data } = await supabase.from('categorias_servicio').select('*').order('created_at', { ascending: true });
    if (data) setCategorias(data as Categoria[]);
  };

  const guardarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCategoriaText) return;
    await supabase.from('categorias_servicio').insert([{ nombre: nuevaCategoriaText }]);
    setNuevaCategoriaText('');
    recargarCategorias();
  };

  const eliminarCategoria = async (id: string) => {
    if (window.confirm("¿Borrar esta categoría? (Los servicios que ya la usen conservarán el nombre, pero desaparecerá del menú)")) {
      await supabase.from('categorias_servicio').delete().eq('id', id);
      recargarCategorias();
    }
  };

  const prepararEdicion = (servicio: Servicio) => {
    setNuevo({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion || '',
      categoria: servicio.categoria || (categorias[0]?.nombre || 'General'),
      precio_base: servicio.precio_base,
      procesos: servicio.procesos || [] 
    });
    setIdEditando(servicio.id);
    setMostrarForm(true);
  };

  const abrirNuevoFormulario = () => {
    setIdEditando(null);
    setNuevo({ nombre: '', descripcion: '', categoria: categorias[0]?.nombre || 'General', precio_base: 0, procesos: [] });
    setMostrarForm(true);
  };

  const agregarProceso = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (nuevoProcesoText.trim() === '') return;
    setNuevo(prev => ({
        ...prev, 
        procesos: [...(prev.procesos || []), nuevoProcesoText.trim()]
    }));
    setNuevoProcesoText('');
  };

  const eliminarProceso = (indexToRemove: number) => {
    setNuevo(prev => ({
        ...prev,
        procesos: (prev.procesos || []).filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const guardarServicio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (idEditando) {
      await supabase.from('servicios').update({
        nombre: nuevo.nombre,
        descripcion: nuevo.descripcion,
        categoria: nuevo.categoria,
        precio_base: nuevo.precio_base,
        procesos: nuevo.procesos
      }).eq('id', idEditando);
    } else {
      await supabase.from('servicios').insert([{
        nombre: nuevo.nombre,
        descripcion: nuevo.descripcion,
        categoria: nuevo.categoria,
        precio_base: nuevo.precio_base,
        procesos: nuevo.procesos
      }]);
    }
    setMostrarForm(false);
    recargarServicios();
  };

  const eliminarServicio = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar este servicio del catálogo?")) {
      await supabase.from('servicios').delete().eq('id', id);
      recargarServicios();
    }
  };

  const serviciosFiltrados = servicios.filter(s => 
    s.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    (s.categoria && s.categoria.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const formatearDinero = (cantidad: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cantidad);
  };

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white font-sans pb-24 md:pb-8">
      {/* 🟢 HEADER RESPONSIVO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic">Catálogo</h1>
          <p className="text-heraco font-bold text-xs md:text-sm tracking-widest mt-1">Servicios y Tarifas Base</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-4 w-full md:w-auto">
          <button onClick={() => setMostrarModalCategorias(true)} className="flex-1 md:flex-none justify-center bg-zinc-900 border border-zinc-700 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-xl md:rounded-2xl flex items-center gap-2 hover:bg-zinc-800 transition-all text-[10px] md:text-xs">
            <Settings size={16} className="md:w-5 md:h-5" /> CATEGORÍAS
          </button>
          <button onClick={abrirNuevoFormulario} className="flex-1 md:flex-none justify-center bg-heraco text-black font-extrabold py-2 md:py-3 px-4 md:px-6 rounded-xl md:rounded-2xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-heraco/20 text-[10px] md:text-xs">
            <Plus size={16} className="md:w-5 md:h-5" /> AGREGAR SERVICIO
          </button>
        </div>
      </div>

      <div className="relative mb-6 md:mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input 
          type="text"
          placeholder="Buscar por nombre o categoría..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl md:rounded-2xl py-3 md:py-4 pl-12 pr-4 focus:border-heraco focus:outline-none transition-all text-sm md:text-base font-bold"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {serviciosFiltrados.map((s) => (
          <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-5 md:p-6 rounded-3xl md:rounded-4xl hover:border-heraco/40 transition-all group relative flex flex-col justify-between shadow-xl">
            <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
              <button onClick={() => prepararEdicion(s)} className="text-zinc-400 hover:text-heraco bg-black/50 p-1.5 md:p-2 rounded-lg border border-zinc-800 md:border-0"><Pencil size={14} className="md:w-4 md:h-4" /></button>
              <button onClick={() => eliminarServicio(s.id)} className="text-zinc-400 hover:text-red-500 bg-black/50 p-1.5 md:p-2 rounded-lg border border-zinc-800 md:border-0"><Trash2 size={14} className="md:w-4 md:h-4" /></button>
            </div>
            
            <div>
              <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-300 text-[8px] md:text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest mb-4 md:mb-5 border border-zinc-700 mt-2 md:mt-0">
                <Tag size={10} /> {s.categoria || 'Sin Categoría'}
              </span>
              <h3 className="font-bold text-lg md:text-xl leading-tight mb-2 pr-14 md:pr-12 truncate">{s.nombre}</h3>
              <p className="text-xs md:text-sm text-zinc-500 mb-4 line-clamp-3">{s.descripcion || 'Sin descripción detallada.'}</p>
              
              {/* RENDER DE PROCESOS EN LA TARJETA */}
              {s.procesos && s.procesos.length > 0 && (
                <div className="mb-6 md:mb-8 border-t border-zinc-800/50 pt-4">
                    <p className="text-[8px] md:text-[9px] font-black uppercase text-zinc-600 mb-2 flex items-center gap-1 tracking-widest"><ListChecks size={12}/> Procesos Incluidos</p>
                    <div className="flex flex-wrap gap-1">
                        {s.procesos.map((p, i) => (
                            <span key={i} className="bg-black text-zinc-400 text-[8px] md:text-[9px] font-bold px-2 py-1 rounded border border-zinc-800">
                                {p}
                            </span>
                        ))}
                    </div>
                </div>
              )}
            </div>

            <div className="bg-black/50 border border-zinc-800 rounded-xl md:rounded-2xl p-4 flex items-center justify-between mt-auto">
              <span className="text-[10px] md:text-xs text-zinc-500 uppercase font-bold">Tarifa Base</span>
              <span className="text-xl md:text-2xl font-black text-heraco italic tracking-tighter">{formatearDinero(s.precio_base)}</span>
            </div>
          </div>
        ))}
        {serviciosFiltrados.length === 0 && (
           <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] md:text-xs">No se encontraron servicios</p>
           </div>
        )}
      </div>

      {/* MODAL: FORMULARIO DE SERVICIO */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-[2.5rem] p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setMostrarForm(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={20} /></button>
            <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-heraco mb-6 pr-6">
              {idEditando ? 'Editar Servicio' : 'Nuevo Servicio'}
            </h2>
            
            <form onSubmit={guardarServicio} className="space-y-4 md:space-y-5">
              <div>
                <label className="text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest ml-1 mb-1 block">Nombre del Servicio</label>
                <input required value={nuevo.nombre} className="w-full bg-black border border-zinc-800 p-3 md:p-4 rounded-xl md:rounded-2xl focus:border-heraco outline-none text-white text-sm font-bold" onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest ml-1 mb-1 block">Categoría</label>
                  <select className="w-full bg-black border border-zinc-800 p-3 md:p-4 rounded-xl md:rounded-2xl focus:border-heraco outline-none text-white text-xs md:text-sm font-bold appearance-none cursor-pointer" value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})}>
                    {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest ml-1 mb-1 block">Tarifa Base (MXN)</label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-heraco" />
                    <input required type="number" step="0.01" value={nuevo.precio_base} className="w-full bg-black border border-zinc-800 p-3 md:p-4 pl-8 md:pl-10 rounded-xl md:rounded-2xl focus:border-heraco outline-none text-white font-black text-sm md:text-base" onChange={e => setNuevo({...nuevo, precio_base: parseFloat(e.target.value) || 0})} />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest ml-1 mb-1 block">Descripción (Entregables)</label>
                <textarea rows={3} value={nuevo.descripcion} className="w-full bg-black border border-zinc-800 p-3 md:p-4 rounded-xl md:rounded-2xl focus:border-heraco outline-none text-white text-xs md:text-sm custom-scrollbar resize-none" onChange={e => setNuevo({...nuevo, descripcion: e.target.value})} />
              </div>

              {/* PROCESOS */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                <label className="text-[9px] md:text-[10px] tracking-widest text-zinc-500 uppercase font-black mb-3 flex items-center gap-2">
                    <ListChecks size={14} className="text-heraco"/> Fases de Producción (Opcional)
                </label>
                
                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        placeholder="Ej: Diseño, Instalación..."
                        value={nuevoProcesoText}
                        onChange={(e) => setNuevoProcesoText(e.target.value)}
                        className="flex-1 bg-black border border-zinc-800 p-3 rounded-xl focus:border-heraco outline-none text-white text-xs md:text-sm font-bold"
                        onKeyDown={(e) => { 
                            if(e.key === 'Enter') { 
                                e.preventDefault(); 
                                agregarProceso(); 
                            } 
                        }}
                    />
                    <button type="button" onClick={agregarProceso} className="bg-heraco text-black px-4 rounded-xl hover:scale-105 transition-transform">
                        <Plus size={18} />
                    </button>
                </div>
                
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                    {(nuevo.procesos || []).map((proceso, index) => (
                        <div key={index} className="flex justify-between items-center bg-black p-2.5 md:p-3 rounded-xl border border-zinc-800 animate-in fade-in zoom-in duration-200">
                            <span className="text-[10px] md:text-xs font-bold text-zinc-300">{proceso}</span>
                            <button type="button" onClick={() => eliminarProceso(index)} className="text-zinc-600 hover:text-red-500 transition-colors p-1">
                                <X size={14}/>
                            </button>
                        </div>
                    ))}
                    {(nuevo.procesos?.length === 0) && (
                        <p className="text-[10px] md:text-xs text-zinc-600 italic text-center py-4">No se han definido fases.</p>
                    )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                 <button type="button" onClick={() => setMostrarForm(false)} className="w-1/3 bg-zinc-900 border border-zinc-800 text-zinc-400 font-black py-3 md:py-4 rounded-xl md:rounded-2xl uppercase text-[9px] md:text-[10px] tracking-widest hover:bg-zinc-800 hover:text-white transition-all">Cancelar</button>
                 <button type="submit" className="w-2/3 bg-heraco text-black font-black py-3 md:py-4 rounded-xl md:rounded-2xl hover:scale-[1.02] transition-transform text-[10px] md:text-xs tracking-widest shadow-lg shadow-heraco/10 uppercase">
                   Guardar
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GESTIONAR CATEGORÍAS */}
      {mostrarModalCategorias && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-sm rounded-4xl md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative">
            <button onClick={() => setMostrarModalCategorias(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={20} /></button>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white italic mb-6">Categorías</h2>
            
            <form onSubmit={guardarCategoria} className="flex gap-2 mb-6">
              <input required placeholder="Nueva (Ej: Impresión)" value={nuevaCategoriaText} onChange={e => setNuevaCategoriaText(e.target.value)} className="flex-1 bg-black border border-zinc-800 p-3 md:p-4 rounded-xl focus:border-heraco outline-none text-white text-xs md:text-sm font-bold" />
              <button type="submit" className="bg-heraco text-black px-4 rounded-xl hover:scale-105 transition-transform"><Plus size={18} /></button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {categorias.map(c => (
                <div key={c.id} className="flex justify-between items-center bg-black p-3 md:p-4 rounded-xl border border-zinc-800">
                  <span className="font-bold text-xs md:text-sm text-zinc-300 uppercase">{c.nombre}</span>
                  <button onClick={() => eliminarCategoria(c.id)} className="text-zinc-600 hover:text-red-500 transition-colors p-1"><Trash2 size={16} className="md:w-4 md:h-4" /></button>
                </div>
              ))}
              {categorias.length === 0 && <p className="text-[10px] md:text-xs text-zinc-600 italic text-center py-4">No hay categorías configuradas.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}