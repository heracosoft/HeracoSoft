/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Package, CheckCircle2, User, MapPin, 
  Phone, Mail, ExternalLink, ChevronDown, ChevronUp 
} from 'lucide-react';

// --- IMPORTACIONES DEL MAPA ---
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- PIN PERSONALIZADO HERACO ---
const heracoPin = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div style="color: #cbd620; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.5)); transform: translate(-50%, -100%);"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="black"></circle></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

interface Proyecto { 
  id: string; 
  nombre: string; 
  cliente: string; 
  estado: string; 
  descripcion?: string;
  portada_url?: string;
  encargado_envio?: string;
  direccion?: string;
  coordenadas?: string;
}

export default function Entregas() {
  const [entregas, setEntregas] = useState<Proyecto[]>([]);
  const [clientesDB, setClientesDB] = useState<any[]>([]); 
  const [cargando, setCargando] = useState(true);
  
  // Estado para saber qué tarjeta está abierta
  const [expandido, setExpandido] = useState<string | null>(null);

  const traerEntregas = useCallback(async () => {
    setCargando(true);
    
    // 0. Obtenemos el usuario real que inició sesión
    const { data: { user } } = await supabase.auth.getUser();
    let esAdmin = false;

    // 1. Revisamos qué rol tiene este usuario
    if (user) {
      const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single();
      const rol = perfil?.rol?.toLowerCase() || '';
      esAdmin = (rol === 'admin' || rol === 'administrador');
    }

    // 2. Traemos todos los clientes (para ver su info de contacto al abrir la tarjeta)
    const { data: clients } = await supabase.from('clientes').select('*');
    if (clients) setClientesDB(clients);

    // 3. CONSULTA MAESTRA DE ENVÍOS
    // Buscamos proyectos en estado Despachado que NO estén archivados
    let query = supabase.from('proyectos')
      .select('*')
      .eq('estado', 'Despachado')
      .eq('archivado', false)
      .order('created_at', { ascending: false });
    
    // FILTRO DE SEGURIDAD: 
    // Si NO eres admin, te aplicamos el filtro para que solo veas tus propios paquetes.
    // Si eres admin, esta regla se ignora y ves la lista completa de todos los repartidores.
    if (user && !esAdmin) {
      query = query.eq('encargado_envio', user.id);
    }

    const { data: envios, error } = await query;
    
    if (envios) {
      setEntregas(envios as Proyecto[]);
    } else if (error) {
      console.error("Error al traer entregas:", error);
    }
    
    setCargando(false);
  }, []);

  // Reparación del useEffect para que Vercel no marque advertencias
  useEffect(() => {
    const iniciar = async () => { await traerEntregas(); };
    iniciar();
  }, [traerEntregas]);

  const confirmarEntrega = async (id: string, nombre: string) => {
    if (window.confirm(`¿Confirmas la entrega exitosa de "${nombre}"?`)) {
      const { error } = await supabase
        .from('proyectos')
        .update({ estado: 'Entregado' }) 
        .eq('id', id);

      if (!error) {
        alert("✅ Paquete marcado como entregado.");
        traerEntregas(); 
      } else {
        alert("Hubo un error: " + error.message);
      }
    }
  };

  const abrirEnGoogleMaps = (coords?: string, direccionStr?: string, e?: any) => {
    e?.stopPropagation(); 
    if (coords) {
      const url = `https://www.google.com/maps?q=${coords.replace(/\s/g, '')}`;
      window.open(url, '_blank');
    } else if (direccionStr) {
      const url = `https://www.google.com/maps?q=$${encodeURIComponent(direccionStr)}`;
      window.open(url, '_blank');
    } else {
      alert("No hay una dirección o coordenadas válidas.");
    }
  };

  const generarLinkWhatsApp = (telefono: string) => {
    const limpiado = telefono.replace(/\D/g, ''); 
    if (limpiado.length === 10) return `https://wa.me/52${limpiado}`;
    return `https://wa.me/${limpiado}`;
  };

  return (
    <div className="p-8 w-full min-h-screen text-white font-sans bg-black">
      
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-heraco flex items-center gap-3">
            Mis Entregas
          </h1>
          <p className="text-zinc-500 font-bold text-xs tracking-widest uppercase mt-2">
            Logística y Despacho
          </p>
        </div>
      </header>

      {cargando ? (
        <div className="flex justify-center items-center h-64">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-heraco border-t-transparent"></div>
        </div>
      ) : entregas.length === 0 ? (
        
        <div className="border border-dashed border-zinc-800 rounded-4xl p-20 flex flex-col items-center justify-center text-center mt-10 bg-zinc-900/20">
          <Package size={48} className="text-zinc-700 mb-6" />
          <h3 className="text-lg font-black text-zinc-500 uppercase italic tracking-widest">
            No hay entregas asignadas
          </h3>
          <p className="text-[10px] text-zinc-600 font-bold uppercase mt-2">
            Todo está al día por el momento.
          </p>
        </div>

      ) : (

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {entregas.map(proyecto => {
            const clienteInfo = clientesDB.find(c => c.empresa === proyecto.cliente || c.nombre_contacto === proyecto.cliente);

            return (
              <div key={proyecto.id} className={`bg-zinc-900 border transition-all duration-300 rounded-4xl relative overflow-hidden flex flex-col shadow-xl cursor-pointer hover:border-heraco/50 ${expandido === proyecto.id ? 'border-heraco/50 ring-1 ring-heraco/20' : 'border-zinc-800'}`}>
                <div className="absolute top-0 left-0 w-full h-1.5 bg-heraco"></div>
                
                <div 
                  className="p-6 pb-4 flex flex-col"
                  onClick={() => setExpandido(expandido === proyecto.id ? null : proyecto.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-heraco/10 text-heraco text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border border-heraco/20 flex items-center gap-1">
                      <Package size={10} /> EN RUTA
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-black text-xl text-white leading-tight uppercase italic mb-1">{proyecto.nombre}</h3>
                      <p className="text-xs text-zinc-400 font-bold flex items-center gap-1.5 uppercase">
                        <User size={12} className="text-heraco"/> {proyecto.cliente}
                      </p>
                    </div>
                    {expandido === proyecto.id ? <ChevronUp className="text-zinc-500 shrink-0"/> : <ChevronDown className="text-zinc-500 shrink-0"/>}
                  </div>

                  {expandido !== proyecto.id && (
                    <p className="text-[10px] text-zinc-500 font-bold flex items-start gap-1.5 mt-4 line-clamp-1 border-t border-zinc-800/50 pt-4">
                      <MapPin size={12} className="shrink-0 mt-0.5"/> 
                      {proyecto.direccion || "Dirección no especificada. Expandir para detalles."}
                    </p>
                  )}
                </div>

                {expandido === proyecto.id && (
                  <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-2 duration-300 flex flex-col flex-1">
                    
                    <div className="bg-black/50 border border-zinc-800/50 rounded-2xl p-4 mb-4 space-y-3">
                      <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 italic">Datos de Contacto</h4>
                      {clienteInfo ? (
                        <>
                          <div className="flex items-center gap-3 text-xs text-zinc-300">
                            <User size={14} className="text-heraco shrink-0"/> <span>{clienteInfo.nombre_contacto}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-zinc-300">
                            <Phone size={14} className="text-heraco shrink-0"/> 
                            {clienteInfo.telefono ? (
                              <a 
                                href={generarLinkWhatsApp(clienteInfo.telefono)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:text-heraco transition-colors underline decoration-zinc-700 underline-offset-4 flex items-center gap-2"
                              >
                                {clienteInfo.telefono} 
                                <span className="text-[8px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded font-bold tracking-widest uppercase">
                                  WhatsApp
                                </span>
                              </a>
                            ) : (
                              <span>Sin teléfono guardado</span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-zinc-300">
                            <Mail size={14} className="text-heraco shrink-0"/> <span className="truncate">{clienteInfo.email || 'Sin correo'}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-zinc-500 italic">No se encontraron datos de contacto adicionales.</p>
                      )}
                    </div>

                    <div className="bg-black/50 border border-zinc-800/50 rounded-2xl p-4 mb-6 flex-1 flex flex-col">
                      <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 italic">Destino de Entrega</h4>
                      <p className="text-xs text-zinc-300 font-bold mb-3 flex items-start gap-2">
                        <MapPin size={14} className="text-heraco shrink-0 mt-0.5"/> 
                        {proyecto.direccion || "No hay una dirección escrita."}
                      </p>

                      {proyecto.coordenadas ? (
                        <div className="w-full h-32 rounded-xl overflow-hidden border border-zinc-800 relative z-0 mb-3">
                          <MapContainer 
                            center={[parseFloat(proyecto.coordenadas.split(',')[0]), parseFloat(proyecto.coordenadas.split(',')[1])]} 
                            zoom={15} 
                            style={{ height: '100%', width: '100%', zIndex: 0 }} 
                            zoomControl={false} 
                            dragging={false}
                          >
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                            <Marker position={[parseFloat(proyecto.coordenadas.split(',')[0]), parseFloat(proyecto.coordenadas.split(',')[1])]} icon={heracoPin} />
                          </MapContainer>
                        </div>
                      ) : (
                        <div className="w-full h-16 bg-zinc-900 border border-zinc-800 border-dashed rounded-xl flex items-center justify-center mb-3">
                          <p className="text-[10px] text-zinc-600 font-bold uppercase">Sin coordenadas</p>
                        </div>
                      )}

                      <button 
                        onClick={(e) => abrirEnGoogleMaps(proyecto.coordenadas, proyecto.direccion, e)}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-2.5 rounded-xl transition-all uppercase text-[10px] tracking-widest flex justify-center items-center gap-2 mt-auto"
                      >
                        <ExternalLink size={14} className="text-heraco"/> Abrir en Google Maps
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => confirmarEntrega(proyecto.id, proyecto.nombre)}
                      className="w-full bg-heraco text-black font-black py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition-all uppercase text-xs tracking-widest flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(203,222,32,0.15)] mt-auto"
                    >
                      <CheckCircle2 size={18} /> Confirmar Entrega
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}