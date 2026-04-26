import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
// Se agregó Star para marcar la principal
import { Users, Plus, Mail, Phone, Building2, Trash2, Search, X, MapPin, Settings, Maximize2, Pencil, Share2, ChevronDown, ChevronUp, Star } from 'lucide-react'; 
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface Sucursal {
  nombre: string;
  direccion: string;
  coordenadas?: string;
  esPrincipal?: boolean; // <-- Nueva propiedad
}

interface TipoCliente {
  id: string;
  nombre: string;
  color: string;
}

interface Cliente {
  id: string;
  nombre_contacto: string;
  empresa: string;
  email: string;
  telefono: string;
  tipo_cliente_id?: string;
  logo?: string;
  sucursales: Sucursal[];
}

const heracoPin = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div style="color: #cbd620; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.5)); transform: translate(-50%, -100%);"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="black"></circle></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

function ClicEnMapa({ setCoordenadas }: { setCoordenadas: (coords: string) => void }) {
  const [posicion, setPosicion] = useState<[number, number] | null>(null);
  useMapEvents({
    click(e) {
      setPosicion([e.latlng.lat, e.latlng.lng]);
      setCoordenadas(`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
    },
  });
  return posicion === null ? null : <Marker position={posicion} icon={heracoPin} />;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tipos, setTipos] = useState<TipoCliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarModalTipos, setMostrarModalTipos] = useState(false);
  const [mapaExpandido, setMapaExpandido] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);

  const [nuevoTipo, setNuevoTipo] = useState('');
  const [sucursalesTemp, setSucursalesTemp] = useState<Sucursal[]>([]);
  const [nuevaSucursal, setNuevaSucursal] = useState<Sucursal>({ nombre: '', direccion: '', coordenadas: '', esPrincipal: false });

  const [clienteExpandido, setClienteExpandido] = useState<Record<string, boolean>>({});
  
  const [nuevo, setNuevo] = useState({
    nombre_contacto: '',
    empresa: '',
    email: '',
    telefono: '',
    tipo_cliente_id: '',
    logo: ''
  });

  useEffect(() => {
    let montado = true;
    const traerDatos = async () => {
      const { data: dataClientes } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
      const { data: dataTipos } = await supabase.from('tipos_cliente').select('*').order('created_at', { ascending: true });
      
      if (montado) {
        if (dataClientes) setClientes(dataClientes as Cliente[]);
        if (dataTipos) {
          setTipos(dataTipos as TipoCliente[]);
          if (dataTipos.length > 0 && !idEditando) setNuevo(prev => ({ ...prev, tipo_cliente_id: dataTipos[0].id }));
        }
      }
    };
    traerDatos();
    return () => { montado = false; };
  }, [idEditando]);

  const toggleExpandir = (id: string) => {
    setClienteExpandido(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const recargarClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
    if (data) setClientes(data as Cliente[]);
  };

  const recargarTipos = async () => {
    const { data } = await supabase.from('tipos_cliente').select('*').order('created_at', { ascending: true });
    if (data) setTipos(data as TipoCliente[]);
  };

  const guardarTipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTipo) return;
    await supabase.from('tipos_cliente').insert([{ nombre: nuevoTipo }]);
    setNuevoTipo('');
    recargarTipos();
  };

  const eliminarTipo = async (id: string) => {
    if (window.confirm("¿Borrar este tipo de cliente?")) {
      await supabase.from('tipos_cliente').delete().eq('id', id);
      recargarTipos();
    }
  };

  // --- LÓGICA DE SUCURSAL PRINCIPAL ---
  const marcarComoPrincipal = (index: number) => {
    setSucursalesTemp(prev => prev.map((s, i) => ({
      ...s,
      esPrincipal: i === index
    })));
  };

  const agregarSucursalLista = () => {
    if (nuevaSucursal.nombre && nuevaSucursal.direccion) {
      // Si es la primera, marcarla como principal automáticamente
      const esLaPrimera = sucursalesTemp.length === 0;
      setSucursalesTemp([...sucursalesTemp, { ...nuevaSucursal, esPrincipal: esLaPrimera }]);
      setNuevaSucursal({ nombre: '', direccion: '', coordenadas: '', esPrincipal: false });
    }
  };

  const prepararEdicion = (cliente: Cliente) => {
    setNuevo({
      nombre_contacto: cliente.nombre_contacto || '',
      empresa: cliente.empresa || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      tipo_cliente_id: cliente.tipo_cliente_id || tipos[0]?.id || '',
      logo: cliente.logo || ''
    });
    setSucursalesTemp(cliente.sucursales || []);
    setIdEditando(cliente.id);
    setMostrarForm(true);
  };

  const abrirNuevoFormulario = () => {
    setIdEditando(null);
    setNuevo({ nombre_contacto: '', empresa: '', email: '', telefono: '', tipo_cliente_id: tipos[0]?.id || '', logo: '' });
    setSucursalesTemp([]);
    setNuevaSucursal({ nombre: '', direccion: '', coordenadas: '', esPrincipal: false });
    setMostrarForm(true);
  };

  const guardarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    const sucursalesFinales = [...sucursalesTemp];

    if (idEditando) {
      await supabase.from('clientes').update({ ...nuevo, sucursales: sucursalesFinales }).eq('id', idEditando);
    } else {
      await supabase.from('clientes').insert([{ ...nuevo, sucursales: sucursalesFinales }]);
    }
    
    setMostrarForm(false);
    recargarClientes();
  };

  const eliminarCliente = async (id: string) => {
    if (window.confirm("¿Eliminar este cliente por completo?")) {
      await supabase.from('clientes').delete().eq('id', id);
      recargarClientes();
    }
  };

  const compartirUbicacion = (sucursal: Sucursal, empresa: string) => {
    if (!sucursal.coordenadas) {
      alert("Esta sucursal no tiene coordenadas fijadas.");
      return;
    }
    const coords = sucursal.coordenadas.replace(/\s/g, '');
    const url = `https://www.google.com/maps?q=${coords}`;
    
    navigator.clipboard.writeText(url);
    alert(`Link de Google Maps para "${empresa} - ${sucursal.nombre}" copiado al portapapeles.`);
  };

  const clientesFiltrados = clientes.filter(c => 
    (c.empresa && c.empresa.toLowerCase().includes(busqueda.toLowerCase())) || 
    c.nombre_contacto.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-8 bg-black min-h-screen text-white font-sans relative z-0">
      <div className="flex justify-between items-center mb-10 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Directorio</h1>
          <p className="text-heraco font-bold text-sm tracking-widest">Gestión de Clientes y Entregas</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setMostrarModalTipos(true)} className="bg-zinc-900 border border-zinc-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 hover:bg-zinc-800 transition-all text-xs">
            <Settings size={18} /> CONFIGURAR TIPOS
          </button>
          <button onClick={abrirNuevoFormulario} className="bg-heraco text-black font-extrabold py-3 px-6 rounded-2xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-heraco/20 text-xs">
            <Plus size={18} /> NUEVO CLIENTE
          </button>
        </div>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input 
          type="text"
          placeholder="Buscar por empresa o contacto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:border-heraco focus:outline-none transition-all font-bold"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6 relative z-0">
        {clientesFiltrados.map((c) => {
          const tipoObj = tipos.find(t => t.id === c.tipo_cliente_id);
          const tieneSucursales = c.sucursales && c.sucursales.length > 0;
          
          // Buscar la principal marcada, si no hay ninguna (datos viejos), usar la primera
          const sucursalPrincipal = c.sucursales.find(s => s.esPrincipal) || (tieneSucursales ? c.sucursales[0] : null);
          const sucursalesSecundarias = c.sucursales.filter(s => s !== sucursalPrincipal);
          const estaExpandido = clienteExpandido[c.id] || false;

          return (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl hover:border-heraco/40 transition-all group relative">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => prepararEdicion(c)} className="text-zinc-600 hover:text-heraco bg-black p-2 rounded-lg"><Pencil size={16} /></button>
                <button onClick={() => eliminarCliente(c.id)} className="text-zinc-600 hover:text-red-500 bg-black p-2 rounded-lg"><Trash2 size={16} /></button>
              </div>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-black border border-zinc-800 p-3 rounded-2xl w-16 h-16 flex items-center justify-center overflow-hidden shrink-0">
                  {c.logo ? <img src={c.logo} alt={c.empresa} className="w-full h-full object-contain" /> : <Building2 className="text-heraco" size={24} />}
                </div>
                <div>
                  <h3 className="font-bold text-xl leading-none mb-2">{c.empresa || 'Empresa General'}</h3>
                  {tipoObj && (
                    <span className="bg-heraco/20 text-heraco text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider border border-heraco/30">
                      {tipoObj.nombre}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm mb-6 pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-3 text-zinc-400 font-bold"><Users size={16} /> <span>{c.nombre_contacto}</span></div>
                <div className="flex items-center gap-3 text-zinc-400 font-bold"><Mail size={16} /> <span>{c.email || 'Sin correo'}</span></div>
                <div className="flex items-center gap-3 text-zinc-400 font-bold"><Phone size={16} /> <span>{c.telefono || 'Sin teléfono'}</span></div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Logística de Entrega</p>
                    {sucursalesSecundarias.length > 0 && (
                        <button 
                            onClick={() => toggleExpandir(c.id)}
                            className="text-[10px] text-heraco font-black flex items-center gap-1 hover:underline uppercase italic"
                        >
                            {estaExpandido ? 'Contraer' : `Ver más (${sucursalesSecundarias.length})`}
                            {estaExpandido ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                        </button>
                    )}
                </div>

                <div className="space-y-2">
                  {sucursalPrincipal ? (
                    <div className="bg-black/50 p-3 rounded-xl border border-heraco/30 flex items-start justify-between gap-3 shadow-inner">
                      <div className="flex items-start gap-3">
                        <MapPin size={16} className="text-heraco mt-0.5 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-bold text-white leading-none">{sucursalPrincipal.nombre}</p>
                            <span className="text-[8px] bg-heraco text-black px-1 rounded font-black uppercase tracking-tighter italic">Matriz</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-tight font-medium">{sucursalPrincipal.direccion}</p>
                        </div>
                      </div>
                      {sucursalPrincipal.coordenadas && (
                        <button onClick={() => compartirUbicacion(sucursalPrincipal, c.empresa)} className="bg-zinc-800 hover:bg-heraco hover:text-black p-2 rounded-lg transition-all shrink-0">
                          <Share2 size={14} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600 italic">No hay direcciones registradas.</p>
                  )}

                  {estaExpandido && sucursalesSecundarias.map((sucursal, idx) => (
                    <div key={idx} className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-start gap-3">
                        <MapPin size={16} className="text-zinc-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-zinc-300 leading-none mb-1">{sucursal.nombre}</p>
                          <p className="text-[10px] text-zinc-500 leading-tight">{sucursal.direccion}</p>
                        </div>
                      </div>
                      {sucursal.coordenadas && (
                        <button onClick={() => compartirUbicacion(sucursal, c.empresa)} className="bg-zinc-800 hover:bg-heraco hover:text-black p-2 rounded-lg transition-all shrink-0">
                          <Share2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {mostrarForm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-40 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col md:flex-row my-8">
            
            <div className="p-8 flex-1 border-b md:border-b-0 md:border-r border-zinc-800">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-heraco italic">
                  {idEditando ? 'Actualizar Cliente' : 'Registro Maestro'}
                </h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-black ml-1">Nombre de la Empresa</label>
                  <input required value={nuevo.empresa} className="w-full bg-black border border-zinc-800 p-3 rounded-xl mt-1 focus:border-heraco outline-none text-white font-bold" onChange={e => setNuevo({...nuevo, empresa: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-black ml-1">URL Logo (PNG preferente)</label>
                  <input placeholder="https://..." value={nuevo.logo} className="w-full bg-black border border-zinc-800 p-3 rounded-xl mt-1 focus:border-heraco outline-none text-white" onChange={e => setNuevo({...nuevo, logo: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-black ml-1">Contacto Titular</label>
                  <input required value={nuevo.nombre_contacto} className="w-full bg-black border border-zinc-800 p-3 rounded-xl mt-1 focus:border-heraco outline-none text-white font-bold" onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black ml-1">E-mail</label>
                    <input type="email" value={nuevo.email} className="w-full bg-black border border-zinc-800 p-3 rounded-xl mt-1 focus:border-heraco outline-none text-white font-bold" onChange={e => setNuevo({...nuevo, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black ml-1">Teléfono</label>
                    <input value={nuevo.telefono} className="w-full bg-black border border-zinc-800 p-3 rounded-xl mt-1 focus:border-heraco outline-none text-white font-bold" onChange={e => setNuevo({...nuevo, telefono: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-black ml-1">Categoría Comercial</label>
                  <select className="w-full bg-black border border-zinc-800 p-3 rounded-xl mt-1 focus:border-heraco outline-none text-white font-bold" value={nuevo.tipo_cliente_id} onChange={e => setNuevo({...nuevo, tipo_cliente_id: e.target.value})}>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-8 flex-1 bg-zinc-900/50 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Rutas de Entrega</h2>
                  <button onClick={() => setMostrarForm(false)} className="text-zinc-500 hover:text-white bg-black p-2 rounded-full border border-zinc-800"><X size={20} /></button>
                </div>

                <div className="bg-black p-4 rounded-2xl border border-zinc-800 mb-6 space-y-3 shadow-2xl">
                  <input placeholder="Nombre de Sucursal" value={nuevaSucursal.nombre} onChange={e => setNuevaSucursal({...nuevaSucursal, nombre: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-sm outline-none text-white focus:border-heraco font-bold" />
                  <input placeholder="Dirección para logística" value={nuevaSucursal.direccion} onChange={e => setNuevaSucursal({...nuevaSucursal, direccion: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-sm outline-none text-white focus:border-heraco" />
                  
                  <div className="w-full h-32 rounded-lg overflow-hidden border border-zinc-800 relative z-0 group">
                    <button 
                      type="button"
                      onClick={() => setMapaExpandido(true)} 
                      className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Maximize2 className="text-heraco mb-2" size={32} />
                      <span className="text-white font-black tracking-widest text-xs">FIJAR EN MAPA</span>
                    </button>
                    <MapContainer center={[17.0654, -96.7236]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }} zoomControl={false} dragging={false}>
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                      {nuevaSucursal.coordenadas && <Marker position={[parseFloat(nuevaSucursal.coordenadas.split(',')[0]), parseFloat(nuevaSucursal.coordenadas.split(',')[1])]} icon={heracoPin} />}
                    </MapContainer>
                  </div>

                  <button onClick={agregarSucursalLista} type="button" className="w-full bg-heraco/10 text-heraco border border-heraco/30 font-black py-2 rounded-lg text-[10px] uppercase tracking-widest hover:bg-heraco hover:text-black transition-all">
                    + Agregar Ubicación
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {sucursalesTemp.map((s, i) => (
                    <div key={i} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${s.esPrincipal ? 'bg-heraco/10 border-heraco/50 shadow-[0_0_15px_rgba(203,222,32,0.1)]' : 'bg-black border-zinc-800 opacity-60'}`}>
                      <div className="flex gap-3 items-center">
                        <button 
                            type="button" 
                            onClick={() => marcarComoPrincipal(i)}
                            className={`p-1 rounded-full transition-all ${s.esPrincipal ? 'text-heraco scale-125' : 'text-zinc-800 hover:text-zinc-600'}`}
                        >
                            <Star size={18} fill={s.esPrincipal ? "currentColor" : "none"} />
                        </button>
                        <div>
                            <p className={`text-sm font-black ${s.esPrincipal ? 'text-heraco' : 'text-zinc-300'}`}>{s.nombre} {s.esPrincipal && <span className="text-[8px] uppercase italic ml-1 opacity-60">(Principal)</span>}</p>
                            <p className="text-[10px] text-zinc-500 font-medium truncate w-48">{s.direccion}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setSucursalesTemp(sucursalesTemp.filter((_, idx) => idx !== i))} className="text-zinc-800 hover:text-red-500 transition-colors p-2"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={guardarCliente} className="w-full bg-heraco text-black font-black py-4 rounded-xl mt-8 hover:scale-105 transition-transform text-sm shadow-2xl uppercase tracking-widest italic">
                Sincronizar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALES DE MAPA Y TIPOS SE MANTIENEN IGUAL... */}
      {mapaExpandido && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="p-6 flex justify-between items-center bg-zinc-950 border-b border-zinc-800">
            <div>
              <h2 className="text-2xl font-black uppercase text-heraco italic">Geolocalización Heraco</h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Coloca el pin en el punto exacto de descarga</p>
            </div>
            <button onClick={() => setMapaExpandido(false)} className="bg-heraco text-black px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all">
              Confirmar Coordenadas
            </button>
          </div>
          <div className="flex-1 relative z-0">
            <MapContainer center={[17.0654, -96.7236]} zoom={14} style={{ height: '100%', width: '100%', zIndex: 0 }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <ClicEnMapa setCoordenadas={(coords) => setNuevaSucursal({...nuevaSucursal, coordenadas: coords})} />
            </MapContainer>
          </div>
        </div>
      )}

      {mostrarModalTipos && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black uppercase tracking-tighter text-white italic">Segmentación</h2>
              <button onClick={() => setMostrarModalTipos(false)} className="text-zinc-500 hover:text-white"><X /></button>
            </div>
            <form onSubmit={guardarTipo} className="flex gap-2 mb-6">
              <input required placeholder="VIP, Gobierno, etc..." value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value)} className="flex-1 bg-black border border-zinc-800 p-3 rounded-xl focus:border-heraco outline-none text-white font-bold" />
              <button type="submit" className="bg-heraco text-black p-3 rounded-xl hover:brightness-110 transition-all"><Plus /></button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tipos.map(t => (
                <div key={t.id} className="flex justify-between items-center bg-black p-4 rounded-xl border border-zinc-800">
                  <span className="font-black text-xs text-zinc-300 uppercase tracking-widest">{t.nombre}</span>
                  <button onClick={() => eliminarTipo(t.id)} className="text-zinc-600 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}