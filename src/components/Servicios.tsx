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
    <div className="p-8 bg-black min-h-screen text-white font-sans">
      <div className="flex justify-between items-center mb-10 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Catálogo</h1>
          <p className="text-heraco font-bold text-sm tracking-widest">Servicios y Tarifas Base</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setMostrarModalCategorias(true)} className="bg-zinc-900 border border-zinc-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 hover:bg-zinc-800 transition-all">
            <Settings size={20} /> CATEGORÍAS
          </button>
          <button onClick={abrirNuevoFormulario} className="bg-heraco text-black font-extrabold py-3 px-6 rounded-2xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-heraco/20">
            <Plus size={20} /> AGREGAR SERVICIO
          </button>
        </div>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input 
          type="text"
          placeholder="Buscar por nombre o categoría..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:border-heraco focus:outline-none transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {serviciosFiltrados.map((s) => (
          <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl hover:border-heraco/40 transition-all group relative flex flex-col justify-between">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={() => prepararEdicion(s)} className="text-zinc-600 hover:text-heraco bg-black p-2 rounded-lg"><Pencil size={16} /></button>
              <button onClick={() => eliminarServicio(s.id)} className="text-zinc-600 hover:text-red-500 bg-black p-2 rounded-lg"><Trash2 size={16} /></button>
            </div>
            
            <div>
              <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-300 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider mb-4 border border-zinc-700">
                <Tag size={10} /> {s.categoria || 'Sin Categoría'}
              </span>
              <h3 className="font-bold text-xl leading-tight mb-2 pr-12">{s.nombre}</h3>
              <p className="text-sm text-zinc-500 mb-4 line-clamp-3">{s.descripcion || 'Sin descripción detallada.'}</p>
              
              {/* RENDER DE PROCESOS EN LA TARJETA */}
              {s.procesos && s.procesos.length > 0 && (
                <div className="mb-6">
                    <p className="text-[10px] font-black uppercase text-zinc-600 mb-2 flex items-center gap-1 tracking-widest"><ListChecks size={12}/> Procesos</p>
                    <div className="flex flex-wrap gap-1">
                        {s.procesos.map((p, i) => (
                            <span key={i} className="bg-black text-zinc-400 text-[9px] font-bold px-2 py-1 rounded-md border border-zinc-800">
                                {p}
                            </span>
                        ))}
                    </div>
                </div>
              )}
            </div>

            <div className="bg-black border border-zinc-800 rounded-2xl p-4 flex items-center justify-between mt-auto">
              <span className="text-xs text-zinc-500 uppercase font-bold">Precio Base</span>
              <span className="text-xl font-black text-heraco">{formatearDinero(s.precio_base)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: FORMULARIO DE SERVICIO */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-heraco">
                {idEditando ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h2>
              <button onClick={() => setMostrarForm(false)} className="text-zinc-500 hover:text-white"><X /></button>
            </div>
            
            <form onSubmit={guardarServicio} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold ml-1">Nombre del Servicio</label>
                <input required value={nuevo.nombre} className="w-full bg-black border border-zinc-800 p-3 rounded-xl mt-1 focus:border-heraco outline-none text-white" onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold ml-1">Categoría</label>
                <select className="w-full bg-black border border-zinc-800 p-3 rounded-xl mt-1 focus:border-heraco outline-none text-white" value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})}>
                  {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold ml-1">Precio Base (MXN)</label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input required type="number" step="0.01" value={nuevo.precio_base} className="w-full bg-black border border-zinc-800 p-3 pl-9 rounded-xl mt-1 focus:border-heraco outline-none text-white font-bold" onChange={e => setNuevo({...nuevo, precio_base: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold ml-1">Descripción de Entregables</label>
                <textarea rows={3} value={nuevo.descripcion} className="w-full bg-black border border-zinc-800 p-3 rounded-xl mt-1 focus:border-heraco outline-none text-white" onChange={e => setNuevo({...nuevo, descripcion: e.target.value})} />
              </div>

              {/* AQUÍ ESTÁN LOS PROCESOS */}
              <div className="border-t border-zinc-800 pt-4 mt-4">
                <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-black ml-1 mb-3 block items-center gap-2">
                    <ListChecks size={14}/> Procesos Asignados (Opcional)
                </label>
                
                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        placeholder="Ej: Diseño, Armado, Envío..."
                        value={nuevoProcesoText}
                        onChange={(e) => setNuevoProcesoText(e.target.value)}
                        className="flex-1 bg-black border border-zinc-800 p-3 rounded-xl focus:border-heraco outline-none text-white text-sm"
                        onKeyDown={(e) => { 
                            if(e.key === 'Enter') { 
                                e.preventDefault(); 
                                agregarProceso(); 
                            } 
                        }}
                    />
                    <button type="button" onClick={agregarProceso} className="bg-zinc-800 text-white p-3 rounded-xl hover:text-heraco transition-colors">
                        <Plus size={20} />
                    </button>
                </div>
                
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                    {(nuevo.procesos || []).map((proceso, index) => (
                        <div key={index} className="flex justify-between items-center bg-black p-3 rounded-xl border border-zinc-800 animate-in fade-in zoom-in duration-200">
                            <span className="text-xs font-bold text-zinc-300">{proceso}</span>
                            <button type="button" onClick={() => eliminarProceso(index)} className="text-zinc-600 hover:text-red-500 transition-colors">
                                <X size={16}/>
                            </button>
                        </div>
                    ))}
                    {(nuevo.procesos?.length === 0) && (
                        <p className="text-xs text-zinc-600 italic text-center py-2">No has agregado procesos a este material.</p>
                    )}
                </div>
              </div>

              <button type="submit" className="w-full bg-heraco text-black font-black py-4 rounded-xl mt-6 hover:scale-105 transition-transform text-lg shadow-lg">
                GUARDAR SERVICIO
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GESTIONAR CATEGORÍAS */}
      {mostrarModalCategorias && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Categorías</h2>
              <button onClick={() => setMostrarModalCategorias(false)} className="text-zinc-500 hover:text-white"><X /></button>
            </div>
            
            <form onSubmit={guardarCategoria} className="flex gap-2 mb-6">
              <input required placeholder="Ej: Branding" value={nuevaCategoriaText} onChange={e => setNuevaCategoriaText(e.target.value)} className="flex-1 bg-black border border-zinc-800 p-3 rounded-xl focus:border-heraco outline-none text-white" />
              <button type="submit" className="bg-heraco text-black p-3 rounded-xl hover:brightness-110"><Plus /></button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {categorias.map(c => (
                <div key={c.id} className="flex justify-between items-center bg-black p-4 rounded-xl border border-zinc-800">
                  <span className="font-bold text-sm text-zinc-300">{c.nombre}</span>
                  <button onClick={() => eliminarCategoria(c.id)} className="text-zinc-600 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              ))}
              {categorias.length === 0 && <p className="text-xs text-zinc-600 italic">No hay categorías. Agrega una arriba.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}