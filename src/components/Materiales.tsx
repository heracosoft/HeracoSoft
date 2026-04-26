/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, Trash2, Search, X, Pencil, Settings, Ruler, Calculator, ListChecks } from 'lucide-react';

interface Categoria {
  id: string;
  nombre: string;
}

interface Material {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio_base: number;
  unidad_medida: string;
  tiene_ancho_fijo: boolean;
  ancho_fijo_valor: number;
  procesos?: string[];
}

export default function Materiales() {
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busqueda, setBusqueda] = useState('');
  
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarModalCategorias, setMostrarModalCategorias] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);

  const [cotizador, setCotizador] = useState<{[key: string]: {w: number, h: number}}>({});

  const [nuevaCategoriaText, setNuevaCategoriaText] = useState('');
  const [nuevoProcesoText, setNuevoProcesoText] = useState(''); 
  
  const [nuevo, setNuevo] = useState<{
    nombre: string;
    descripcion: string;
    categoria: string;
    precio_base: number;
    unidad_medida: string;
    tiene_ancho_fijo: boolean;
    ancho_fijo_valor: number;
    procesos: string[];
  }>({
    nombre: '',
    descripcion: '',
    categoria: '',
    precio_base: 0,
    unidad_medida: 'M2',
    tiene_ancho_fijo: false,
    ancho_fijo_valor: 0,
    procesos: []
  });

  useEffect(() => {
    let montado = true;
    const traerDatos = async () => {
      const { data: dataMats } = await supabase.from('materiales').select('*').order('categoria', { ascending: true });
      const { data: dataCats } = await supabase.from('categorias_material').select('*').order('created_at', { ascending: true });
      
      if (montado) {
        if (dataMats) setMateriales(dataMats as Material[]);
        if (dataCats) {
          setCategorias(dataCats as Categoria[]);
          if (dataCats.length > 0 && !idEditando) {
            setNuevo(prev => ({ ...prev, categoria: dataCats[0].nombre }));
          }
        }
      }
    };
    traerDatos();
    return () => { montado = false; };
  }, [idEditando]);

  const recargar = async () => {
    const { data } = await supabase.from('materiales').select('*').order('categoria', { ascending: true });
    if (data) setMateriales(data as Material[]);
  };

  const recargarCats = async () => {
    const { data } = await supabase.from('categorias_material').select('*').order('created_at', { ascending: true });
    if (data) setCategorias(data as Categoria[]);
  };

  const calcularPrecioFinal = (m: Material) => {
    const medidas = cotizador[m.id] || { w: 0, h: 0 };
    if (medidas.w <= 0 || medidas.h <= 0) return 0;

    if (m.tiene_ancho_fijo && m.ancho_fijo_valor > 0) {
      const rollo = m.ancho_fijo_valor;
      const lienzosW = Math.ceil(medidas.w / rollo);
      const areaW = (lienzosW * rollo) * medidas.h;
      const lienzosH = Math.ceil(medidas.h / rollo);
      const areaH = (lienzosH * rollo) * medidas.w;
      const areaFinal = Math.min(areaW, areaH);
      return areaFinal * m.precio_base;
    }
    return (medidas.w * medidas.h) * m.precio_base;
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

  const guardarMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (idEditando) {
      await supabase.from('materiales').update(nuevo).eq('id', idEditando);
    } else {
      await supabase.from('materiales').insert([nuevo]);
    }
    setMostrarForm(false);
    recargar();
  };

  const eliminarMaterial = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar este material del inventario?")) {
      await supabase.from('materiales').delete().eq('id', id);
      recargar();
    }
  };

  const guardarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCategoriaText) return;
    await supabase.from('categorias_material').insert([{ nombre: nuevaCategoriaText }]);
    setNuevaCategoriaText('');
    recargarCats();
  };

  const eliminarCategoria = async (id: string) => {
    if (window.confirm("¿Borrar categoría?")) {
      await supabase.from('categorias_material').delete().eq('id', id);
      recargarCats();
    }
  };

  const prepararEdicion = (m: Material) => {
    setNuevo({
      nombre: m.nombre,
      descripcion: m.descripcion || '',
      categoria: m.categoria || (categorias[0]?.nombre || 'General'),
      precio_base: m.precio_base,
      unidad_medida: m.unidad_medida || 'M2',
      tiene_ancho_fijo: m.tiene_ancho_fijo,
      ancho_fijo_valor: m.ancho_fijo_valor,
      procesos: m.procesos || []
    });
    setIdEditando(m.id);
    setMostrarForm(true);
  };

  const abrirNuevoFormulario = () => {
    setIdEditando(null);
    setNuevo({ nombre: '', descripcion: '', categoria: categorias[0]?.nombre || 'General', precio_base: 0, unidad_medida: 'M2', tiene_ancho_fijo: false, ancho_fijo_valor: 0, procesos: [] });
    setMostrarForm(true);
  };

  const materialesFiltrados = materiales.filter(m => 
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    (m.categoria && m.categoria.toLowerCase().includes(busqueda.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white font-sans">
      
      {/* 🟢 CABECERA RESPONSIVA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic">Inventario</h1>
          <p className="text-heraco font-bold text-xs md:text-sm tracking-widest uppercase">Materiales y Desperdicio</p>
        </div>
        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
          <button onClick={() => setMostrarModalCategorias(true)} className="flex-1 md:flex-none justify-center bg-zinc-900 border border-zinc-700 text-white font-bold py-3 px-4 md:px-6 rounded-xl md:rounded-2xl flex items-center gap-2 hover:bg-zinc-800 transition-all text-[10px] md:text-xs">
            <Settings size={16} /> CATEGORÍAS
          </button>
          <button onClick={abrirNuevoFormulario} className="flex-1 md:flex-none justify-center bg-heraco text-black font-extrabold py-3 px-4 md:px-6 rounded-xl md:rounded-2xl flex items-center gap-2 hover:scale-105 transition-all text-[10px] md:text-xs shadow-lg shadow-heraco/20">
            <Plus size={16} /> AGREGAR MATERIAL
          </button>
        </div>
      </div>

      <div className="relative mb-6 md:mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input 
          type="text"
          placeholder="Buscar lona, vinil, tazas..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl md:rounded-2xl py-3.5 md:py-4 pl-12 pr-4 focus:border-heraco focus:outline-none transition-all text-sm md:text-base font-bold"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {materialesFiltrados.map((m) => {
          const resultado = calcularPrecioFinal(m);
          return (
            <div key={m.id} className="bg-zinc-900 border border-zinc-800 p-5 md:p-6 rounded-3xl md:rounded-4xl hover:border-heraco/40 transition-all group flex flex-col shadow-2xl relative">
              
              <div className="flex justify-between items-start mb-4">
                <span className="bg-zinc-800 text-zinc-400 text-[8px] md:text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest border border-zinc-700">
                  {m.categoria}
                </span>
                <div className="flex gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => prepararEdicion(m)} className="text-zinc-400 hover:text-heraco p-2 transition-colors bg-black/50 rounded-lg border border-zinc-800"><Pencil size={14} /></button>
                  <button onClick={() => eliminarMaterial(m.id)} className="text-zinc-400 hover:text-red-500 p-2 transition-colors bg-black/50 rounded-lg border border-zinc-800"><Trash2 size={14} /></button>
                </div>
              </div>

              <h3 className="font-bold text-lg md:text-xl mb-2 pr-10 leading-tight truncate">{m.nombre}</h3>
              
              {m.tiene_ancho_fijo && (
                <div className="flex items-center gap-2 text-heraco mb-4">
                  <Ruler size={14} className="shrink-0" />
                  <span className="text-[9px] md:text-[10px] font-black uppercase">Ancho Fijo: {m.ancho_fijo_valor}m</span>
                </div>
              )}

              {m.procesos && m.procesos.length > 0 && (
                <div className="mb-5">
                    <p className="text-[8px] md:text-[9px] font-black uppercase text-zinc-600 mb-2 flex items-center gap-1 tracking-widest"><ListChecks size={12}/> Procesos</p>
                    <div className="flex flex-wrap gap-1">
                        {m.procesos.map((p, i) => (
                            <span key={i} className="bg-black text-zinc-400 text-[8px] md:text-[9px] font-bold px-2 py-0.5 rounded border border-zinc-800">
                                {p}
                            </span>
                        ))}
                    </div>
                </div>
              )}

              <div className="bg-black/50 border border-zinc-800 rounded-2xl md:rounded-3xl p-4 mb-5 mt-auto">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator size={14} className="text-zinc-500 shrink-0" />
                  <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest">Cotizador Express (m)</span>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    placeholder="W"
                    className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs focus:border-heraco outline-none font-bold"
                    onChange={(e) => setCotizador({...cotizador, [m.id]: {...(cotizador[m.id] || {h:0}), w: parseFloat(e.target.value) || 0}})}
                  />
                  <input 
                    type="number" 
                    placeholder="H"
                    className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs focus:border-heraco outline-none font-bold"
                    onChange={(e) => setCotizador({...cotizador, [m.id]: {...(cotizador[m.id] || {w:0}), h: parseFloat(e.target.value) || 0}})}
                  />
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-800/50 flex justify-between items-center">
                  <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase">Costo:</span>
                  <span className={`font-black text-lg md:text-xl text-white italic`}>
                    ${resultado.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                <span className="text-[9px] md:text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Precio x {m.unidad_medida}</span>
                <span className="text-lg md:text-xl font-black text-heraco">${m.precio_base.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 🟢 MODAL FORMULARIO RESPONSIVO */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-xl md:text-2xl font-black uppercase text-heraco mb-6 italic tracking-tight">
              {idEditando ? 'Editar Material' : 'Nuevo Material'}
            </h2>
            
            <form onSubmit={guardarMaterial} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-1 block">Nombre del Material</label>
                <input required value={nuevo.nombre} className="w-full bg-black border border-zinc-800 p-4 rounded-xl focus:border-heraco outline-none font-bold text-white text-sm" onChange={e => setNuevo({...nuevo, nombre: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black border border-zinc-800 rounded-xl p-2.5">
                  <label className="text-[9px] font-black text-zinc-500 uppercase ml-1 block mb-1">Precio Base</label>
                  <input type="number" step="0.01" value={nuevo.precio_base} className="w-full bg-transparent px-1 focus:outline-none font-black text-heraco text-base" onChange={e => setNuevo({...nuevo, precio_base: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="bg-black border border-zinc-800 rounded-xl p-2.5">
                  <label className="text-[9px] font-black text-zinc-500 uppercase ml-1 block mb-1">Unidad</label>
                  <select className="w-full bg-transparent px-1 focus:outline-none font-bold text-white text-sm" value={nuevo.unidad_medida} onChange={e => setNuevo({...nuevo, unidad_medida: e.target.value})}>
                    <option value="M2">M2</option>
                    <option value="ML">ML</option>
                    <option value="Pieza">Pieza</option>
                  </select>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">¿Tiene ancho fijo?</span>
                  <button 
                    type="button"
                    onClick={() => setNuevo({...nuevo, tiene_ancho_fijo: !nuevo.tiene_ancho_fijo})}
                    className={`w-10 h-5 rounded-full transition-all relative ${nuevo.tiene_ancho_fijo ? 'bg-heraco' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${nuevo.tiene_ancho_fijo ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
                </div>
                
                {nuevo.tiene_ancho_fijo && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                    <label className="text-[9px] font-black text-zinc-500 uppercase mb-1 block">Ancho del rollo (m)</label>
                    <input 
                      type="number" step="0.01" 
                      placeholder="1.52" 
                      className="w-full bg-black border border-zinc-800 p-3 rounded-lg focus:border-heraco outline-none font-black text-white text-sm"
                      value={nuevo.ancho_fijo_valor}
                      onChange={e => setNuevo({...nuevo, ancho_fijo_valor: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                )}
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-black mb-3 flex items-center gap-2">
                    <ListChecks size={14} className="text-heraco"/> Procesos / Checklist
                </label>
                
                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        placeholder="Ej: Impresión, Ojillos..."
                        value={nuevoProcesoText}
                        onChange={(e) => setNuevoProcesoText(e.target.value)}
                        className="flex-1 bg-black border border-zinc-800 p-3 rounded-xl focus:border-heraco outline-none text-white text-xs"
                    />
                    <button type="button" onClick={agregarProceso} className="bg-heraco text-black px-3 rounded-xl hover:brightness-110 transition-all">
                        <Plus size={18} />
                    </button>
                </div>
                
                <div className="space-y-2 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                    {(nuevo.procesos || []).map((proceso, index) => (
                        <div key={index} className="flex justify-between items-center bg-black p-2 rounded-lg border border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-300">{proceso}</span>
                            <button type="button" onClick={() => eliminarProceso(index)} className="text-zinc-600 hover:text-red-500"><X size={14}/></button>
                        </div>
                    ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMostrarForm(false)} className="flex-1 text-zinc-500 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 bg-heraco text-black font-black py-4 rounded-2xl shadow-xl shadow-heraco/10 uppercase text-xs tracking-widest hover:scale-[1.02]">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CATEGORÍAS */}
      {mostrarModalCategorias && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-sm rounded-4xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase tracking-tighter text-white italic">Categorías</h2>
              <button onClick={() => setMostrarModalCategorias(false)} className="text-zinc-500 hover:text-white bg-black p-1.5 rounded-full border border-zinc-800"><X size={18}/></button>
            </div>
            <form onSubmit={guardarCategoria} className="flex gap-2 mb-6">
              <input required placeholder="Nueva..." value={nuevaCategoriaText} onChange={e => setNuevaCategoriaText(e.target.value)} className="flex-1 bg-black border border-zinc-800 p-3 rounded-xl focus:border-heraco outline-none text-white text-xs font-bold" />
              <button type="submit" className="bg-heraco text-black p-3 rounded-xl hover:brightness-110 transition-all"><Plus size={18} /></button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {categorias.map(c => (
                <div key={c.id} className="flex justify-between items-center bg-black p-3 rounded-xl border border-zinc-800">
                  <span className="font-bold text-xs text-zinc-300 uppercase">{c.nombre}</span>
                  <button onClick={() => eliminarCategoria(c.id)} className="text-zinc-700 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}