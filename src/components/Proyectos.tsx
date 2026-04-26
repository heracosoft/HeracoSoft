/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Plus, Trash2, Columns, X, User, 
  Calendar as CalendarIcon, CheckCircle2, FileText, 
  Tag, Image as ImageIcon, AlignLeft, Info, Settings, Loader2, Zap, MapPin, Maximize2, Archive, ArchiveRestore, Layout,
  ListChecks, Check, Banknote, CreditCard, Smartphone
} from 'lucide-react';

// --- IMPORTACIONES DEL MAPA ---
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- PIN PERSONALIZADO HERACO ---
const heracoPin = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div style="color: #cbd620; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.5)); transform: translate(-50%, -100%);"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="black"></circle></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

// --- COMPONENTE PARA CLIC EN MAPA ---
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

// --- INTERFACES ---
interface Sucursal { nombre: string; direccion: string; coordenadas?: string; }
interface Columna { id: string; titulo: string; orden: number; }
interface Tarea { id: string; titulo: string; id_asignado: string; prioridad: string; fecha_limite: string; }
interface Perfil { id: string; nombre: string; }
interface Etiqueta { id?: string; nombre: string; color: string; }

interface Proyecto { 
  id: string; 
  nombre: string; 
  cliente: string; 
  estado: string; 
  descripcion?: string;
  portada_url?: string;
  etiquetas?: Etiqueta[];
  creado_por?: string;
  cotizacion_id?: string;
  venta_id?: string; 
  encargado_envio?: string;
  se_enviara?: boolean;
  direccion?: string;
  coordenadas?: string; 
  archivado?: boolean;
  checklist_procesos?: { producto: string, procesos: { nombre: string, completado: boolean }[] }[]; 
}

export default function Proyectos() {
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [etiquetasDisponibles, setEtiquetasDisponibles] = useState<Etiqueta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');

  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<Proyecto | null>(null);
  const [tareasProyecto, setTareasProyecto] = useState<Tarea[]>([]);
  const [nuevaTarea, setNuevaTarea] = useState({ titulo: '', id_asignado: '', prioridad: 'Pendiente', fecha_limite: '' });
  
  const [clienteData, setClienteData] = useState<any>(null); 
  const [tipoDireccion, setTipoDireccion] = useState<string>(''); 
  const [mapaExpandido, setMapaExpandido] = useState(false);

  const [verArchivados, setVerArchivados] = useState(false);
  const [verDespachados, setVerDespachados] = useState(false); 
  const [mostrarModalColumna, setMostrarModalColumna] = useState(false);
  const [nuevaColumnaTitulo, setNuevaColumnaTitulo] = useState('');
  
  const [mostrarModalProyecto, setMostrarModalProyecto] = useState(false);
  const [nuevoProyecto, setNuevoProyecto] = useState({ nombre: '', cliente: '', estado: '' });
  const [cotizacionPreview, setCotizacionPreview] = useState<any>(null);
  const [cargandoCot, setCargandoCot] = useState(false);
  const [mostrarEditorEtiquetas, setMostrarEditorEtiquetas] = useState(false);
  const [nuevaTag, setNuevaTag] = useState({ nombre: '', color: '#CBDE20' });

  // --- ESTADOS PARA PAGOS DIRECTOS DESDE EL TABLERO ---
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [montoPago, setMontoPago] = useState<number | ''>('');
  const [metodoPagoStr, setMetodoPagoStr] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');

  const [nombreUsuarioActual, setNombreUsuarioActual] = useState('Sistema Heraco');

  const traerTablero = useCallback(async () => {
    const { data: cols } = await supabase.from('columnas_proyectos').select('*').order('orden', { ascending: true });
    
    let query = supabase.from('proyectos').select('*').order('created_at', { ascending: false });

    if (verArchivados) {
        query = query.eq('archivado', true);
    } else if (verDespachados) {
        query = query.eq('archivado', false).eq('estado', 'Despachado');
    } else {
        query = query.eq('archivado', false).neq('estado', 'Despachado');
    }

    const { data: proys } = await query;
    const { data: users } = await supabase.from('perfiles').select('id, nombre');
    const { data: tags } = await supabase.from('etiquetas_agencia').select('*');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: perfil } = await supabase.from('perfiles').select('nombre').eq('id', user.id).maybeSingle();
      if (perfil?.nombre) setNombreUsuarioActual(perfil.nombre);
    }

    if (cols) setColumnas(cols as Columna[]);
    if (proys) setProyectos(proys as Proyecto[]);
    if (users) setUsuarios(users as Perfil[]);
    if (tags) setEtiquetasDisponibles(tags);
    setCargando(false);
  }, [verArchivados, verDespachados]);

  useEffect(() => { 
    const iniciar = async () => { await traerTablero(); };
    iniciar();
  }, [traerTablero]);

  const traerTareasProyecto = async (proyId: string) => {
    const { data } = await supabase.from('tareas').select('*').eq('proyecto_id', proyId).eq('estado', 'activa');
    if (data) setTareasProyecto(data as Tarea[]);
  };

  const traerDatosCliente = async (nombreCliente: string) => {
    const { data, error } = await supabase.from('clientes').select('*').eq('empresa', nombreCliente).single();
    if (!error && data) {
      setClienteData(data);
    } else {
      const { data: data2 } = await supabase.from('clientes').select('*').eq('nombre_contacto', nombreCliente).single();
      if (data2) setClienteData(data2);
    }
  };

  const verCotizacionRapida = async (idReferencia: string, esTicketDeVenta: boolean) => {
    if (!idReferencia || idReferencia === "") return;
    
    setCargandoCot(true);

    try {
      if (esTicketDeVenta) {
        const { data: venta } = await supabase.from('ventas_mostrador').select('*').eq('id', idReferencia).single();
        const { data: detalles } = await supabase.from('detalle_ventas').select('*').eq('venta_id', idReferencia);

        if (venta) {
            const itemsMapeados = detalles?.map(item => ({
                cantidad: item.cantidad,
                servicios: { nombre: item.nombre_producto },
                total_item: item.subtotal
            }));

            setCotizacionPreview({
                folio: venta.id.substring(0,8).toUpperCase(),
                isTicket: true,
                perfiles: { nombre: 'Venta Directa POS' },
                items_cotizacion: itemsMapeados,
                // Ticket directo se asume liquidado, no mostramos botón de pago
                total: venta.total,
                abonado: venta.total 
            });
        }
      } else {
        const { data: cot, error: errCot } = await supabase.from('cotizaciones').select('*, clientes(*)').eq('id', idReferencia).maybeSingle();
        if (errCot) throw errCot;

        if (cot) {
          const { data: itemsRaw } = await supabase.from('items_cotizacion').select('*').eq('cotizacion_id', idReferencia);
          const { data: servs } = await supabase.from('servicios').select('id, nombre');
          const { data: mats } = await supabase.from('materiales').select('id, nombre');
          const todosLosProductos = [...(servs || []), ...(mats || [])];

          const itemsMapeados = itemsRaw?.map(item => {
              let nombreFinal = 'Producto/Material';
              if (item.servicio_id) {
                  const productoEncontrado = todosLosProductos.find(p => p.id === item.servicio_id);
                  if (productoEncontrado) nombreFinal = productoEncontrado.nombre;
              } else {
                  nombreFinal = item.descripcion_personalizada ? item.descripcion_personalizada.split(' | ')[0] : 'Material a Medida';
              }
              return { ...item, servicios: { nombre: nombreFinal } };
          });

          const nombreCreador = proyectoSeleccionado?.creado_por || nombreUsuarioActual;
          
          setCotizacionPreview({
              ...cot,
              perfiles: { nombre: nombreCreador }, 
              items_cotizacion: itemsMapeados
          });
        }
      }
    } catch (e: any) {
      console.error("Error en vista rápida:", e);
      alert("Error al cargar los detalles: " + e.message);
    } finally {
      setCargandoCot(false);
    }
  };

  const procesarPagoDesdeTablero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cotizacionPreview || !montoPago) return;

    // VALIDACIÓN DE SEGURIDAD: Verificar que la caja esté abierta
    const { data: turno } = await supabase.from('turnos_caja').select('id').eq('estado', 'abierta').order('fecha_apertura', { ascending: false }).limit(1).maybeSingle();
    
    if (!turno) {
      return alert("⚠️ ¡ALTO AHI! No hay un turno de caja abierto. Ve a la sección de Punto de Venta y abre la caja para poder ingresar este dinero.");
    }

    const abono = Number(montoPago);
    const nuevoAbonado = (cotizacionPreview.abonado || 0) + abono;
    const liquidada = nuevoAbonado >= cotizacionPreview.total;
    const nuevoEstado = liquidada ? 'Archivada' : cotizacionPreview.estado;

    // Registrar entrada en caja
    const { data: venta } = await supabase.from('ventas_mostrador').insert([{ turno_id: turno.id, total: abono, metodo_pago: metodoPagoStr }]).select().single();
    if (!venta) return alert("Error al registrar el abono en caja.");

    await supabase.from('detalle_ventas').insert([{ venta_id: venta.id, nombre_producto: `Abono/Liquidación Proyecto #${cotizacionPreview.folio}`, cantidad: 1, precio_unitario: abono, subtotal: abono }]);
    await supabase.from('cotizaciones').update({ abonado: nuevoAbonado, estado: nuevoEstado }).eq('id', cotizacionPreview.id);

    alert(`✅ Pago registrado en la Caja Activa. ${liquidada ? '¡El proyecto fue liquidado en su totalidad!' : ''}`);
    
    setCotizacionPreview({ ...cotizacionPreview, abonado: nuevoAbonado, estado: nuevoEstado });
    setMostrarModalPago(false);
    setMontoPago('');
  };

  const guardarCambiosProyecto = async (datosActualizados: Partial<Proyecto>) => {
    if (!proyectoSeleccionado) return;
    setProyectoSeleccionado({ ...proyectoSeleccionado, ...datosActualizados });
    const { error } = await supabase.from('proyectos').update(datosActualizados).eq('id', proyectoSeleccionado.id);
    if (error) {
      alert("⚠️ Error en Supabase: " + error.message);
      traerTablero(); 
    } else {
      traerTablero();
    }
  };

  const finalizarTrabajo = async () => {
    if (!proyectoSeleccionado) return;
    if (window.confirm("¿Seguro que quieres archivar este trabajo? Se moverá al historial.")) {
        const { error } = await supabase.from('proyectos').update({ archivado: true, estado: 'Finalizado' }).eq('id', proyectoSeleccionado.id);
        if (!error) { setProyectoSeleccionado(null); traerTablero(); }
    }
  };

  const restaurarProyecto = async (id: string) => {
    await supabase.from('proyectos').update({ archivado: false, estado: 'Pendiente' }).eq('id', id);
    traerTablero();
  };

  const agregarNuevaColumna = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaColumnaTitulo.trim()) return;
    const ordenNuevo = columnas.length > 0 ? Math.max(...columnas.map(c => c.orden)) + 1 : 1;
    const { error } = await supabase.from('columnas_proyectos').insert([{ titulo: nuevaColumnaTitulo, orden: ordenNuevo }]);
    if (!error) { setNuevaColumnaTitulo(''); setMostrarModalColumna(false); traerTablero(); }
  };

  const realizarEnvioDirecto = async () => {
    if (!proyectoSeleccionado) return;
    if (!proyectoSeleccionado.encargado_envio) return alert("⚠️ ASIGNACIÓN REQUERIDA: Selecciona primero a un responsable de envío.");
    if (!proyectoSeleccionado.direccion) return alert("⚠️ DIRECCIÓN REQUERIDA: Selecciona o escribe una dirección de entrega válida.");

    const { error } = await supabase.from('proyectos').update({ 
      encargado_envio: proyectoSeleccionado.encargado_envio, 
      direccion: proyectoSeleccionado.direccion,
      coordenadas: proyectoSeleccionado.coordenadas,
      estado: 'Despachado' 
    }).eq('id', proyectoSeleccionado.id);

    if (!error) {
      setProyectoSeleccionado(null); 
      setTipoDireccion('');
      traerTablero(); 
      alert(`🚀 ¡ORDEN DESPACHADA! La ficha se movió a la sección de Envíos.`);
    } else {
      alert("Error al actualizar despacho: " + error.message);
    }
  };

  const guardarNuevaSucursalCliente = async () => {
    if (!clienteData || !proyectoSeleccionado?.direccion) return alert("Falta información para guardar.");
    const nombreSucursal = window.prompt("Ponle un nombre a esta dirección para guardarla en el cliente (Ej: Matriz, Evento Sur):", "Nueva Dirección");
    if (!nombreSucursal) return;

    const nuevaSucursal: Sucursal = { nombre: nombreSucursal, direccion: proyectoSeleccionado.direccion, coordenadas: proyectoSeleccionado.coordenadas || '' };
    const sucursalesActualizadas = [...(clienteData.sucursales || []), nuevaSucursal];
    const { error } = await supabase.from('clientes').update({ sucursales: sucursalesActualizadas }).eq('id', clienteData.id);
    
    if (!error) {
      setClienteData({ ...clienteData, sucursales: sucursalesActualizadas });
      setTipoDireccion((sucursalesActualizadas.length - 1).toString());
      alert("¡Dirección guardada exitosamente en el directorio del cliente!");
    } else {
      alert("Error al guardar en el cliente: " + error.message);
    }
  };

  const manejarCambioDireccion = (valor: string) => {
    setTipoDireccion(valor);
    if (valor === 'manual') {
      guardarCambiosProyecto({ direccion: '', coordenadas: '' });
    } else if (valor !== '') {
      const sucursalSeleccionada = clienteData?.sucursales[parseInt(valor)];
      if (sucursalSeleccionada) {
        guardarCambiosProyecto({ direccion: sucursalSeleccionada.direccion, coordenadas: sucursalSeleccionada.coordenadas });
      }
    }
  };

  const agregarProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoProyecto.nombre.trim()) return;
    const { error } = await supabase.from('proyectos').insert([{
        ...nuevoProyecto,
        creado_por: nombreUsuarioActual
    }]);
    if (!error) {
      setNuevoProyecto({ nombre: '', cliente: '', estado: '' });
      setMostrarModalProyecto(false);
      traerTablero();
    }
  };

  const eliminarColumna = async (id: string, titulo: string) => {
    if (window.confirm(`¿Eliminar la fase "${titulo}"?`)) {
      await supabase.from('columnas_proyectos').delete().eq('id', id);
      traerTablero();
    }
  };

  const eliminarFicha = async (id: string) => {
    if (window.confirm("¿Seguro que quieres eliminar esta ficha? Se borrará permanentemente de la base de datos.")) {
      const { error } = await supabase.from('proyectos').delete().eq('id', id);
      if (!error) { setProyectoSeleccionado(null); traerTablero(); }
    }
  };

  const asignarTarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proyectoSeleccionado || !nuevaTarea.titulo || !nuevaTarea.id_asignado) return;
    const { error } = await supabase.from('tareas').insert([{
      ...nuevaTarea,
      proyecto_id: proyectoSeleccionado.id,
      cliente: proyectoSeleccionado.cliente,
      estado: 'activa'
    }]);
    if (!error) {
      setNuevaTarea({ titulo: '', id_asignado: '', prioridad: 'Pendiente', fecha_limite: '' });
      traerTareasProyecto(proyectoSeleccionado.id);
    }
  };

  const toggleEtiquetaEnProyecto = (tag: Etiqueta) => {
    if (!proyectoSeleccionado) return;
    const actuales = proyectoSeleccionado.etiquetas || [];
    const existe = actuales.find(t => t.nombre === tag.nombre);
    const nuevas = existe ? actuales.filter(t => t.nombre !== tag.nombre) : [...actuales, tag];
    guardarCambiosProyecto({ etiquetas: nuevas });
  };

  const toggleProcesoChecklist = async (gIdx: number, pIdx: number) => {
    if(!proyectoSeleccionado || !proyectoSeleccionado.checklist_procesos) return;
    const nuevoChecklist = [...proyectoSeleccionado.checklist_procesos];
    nuevoChecklist[gIdx].procesos[pIdx].completado = !nuevoChecklist[gIdx].procesos[pIdx].completado;

    setProyectoSeleccionado({...proyectoSeleccionado, checklist_procesos: nuevoChecklist});
    await supabase.from('proyectos').update({ checklist_procesos: nuevoChecklist }).eq('id', proyectoSeleccionado.id);
  };

  const renderFicha = (proyecto: Proyecto) => (
    <div key={proyecto.id} draggable={!verArchivados} onDragStart={(e) => e.dataTransfer.setData('idProyecto', proyecto.id)} onClick={() => { 
        setProyectoSeleccionado(proyecto); 
        traerTareasProyecto(proyecto.id);
        traerDatosCliente(proyecto.cliente);
        setTipoDireccion('');
      }} className="bg-zinc-950 border border-zinc-800 rounded-2xl cursor-pointer hover:border-heraco transition-all overflow-hidden shadow-xl active:scale-95 group relative">
      
      {proyecto.encargado_envio && (
        <div className="absolute top-2 right-2 bg-heraco text-black text-[8px] font-black px-2 py-1 rounded-lg flex items-center gap-1 z-10 animate-pulse shadow-lg">
          <Zap size={8} fill="currentColor"/> {proyecto.estado === 'Despachado' ? 'DESPACHADO' : 'EN RUTA'}
        </div>
      )}

      {proyecto.portada_url && <img src={proyecto.portada_url} className="w-full h-24 object-cover border-b border-zinc-800" alt="Portada"/>}
      <div className="p-4">
        <div className="flex flex-wrap gap-1 mb-2">
          {proyecto.etiquetas?.map(t => <span key={t.nombre} className="w-8 h-1 rounded-full" style={{ backgroundColor: t.color }}></span>)}
        </div>
        <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">{proyecto.cliente}</p>
        <h4 className="font-bold text-sm leading-tight text-zinc-200">{proyecto.nombre}</h4>
        {verArchivados && (
            <button onClick={(e) => { e.stopPropagation(); restaurarProyecto(proyecto.id); }} className="mt-3 w-full py-2 bg-heraco/10 text-heraco rounded-lg text-[9px] font-black uppercase border border-heraco/20 hover:bg-heraco hover:text-black transition-all">Restaurar Ficha</button>
        )}
      </div>
    </div>
  );

  if (cargando) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-heraco border-t-transparent"></div></div>;

  return (
    <div className="p-8 bg-black min-h-screen text-white font-sans flex flex-col h-screen overflow-hidden z-0 relative">
      
      <header className="flex justify-between items-center mb-6 shrink-0 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic flex items-center gap-3">
            <Columns className="text-heraco" size={36} /> 
            {verArchivados ? 'Historial / Archivo' : verDespachados ? 'Sección de Envíos' : 'Pipeline'}
          </h1>
          <div className="flex gap-4 mt-2 items-center">
            <p className="text-heraco font-bold text-xs tracking-widest uppercase italic border-r border-zinc-800 pr-4">Heraco Operations</p>
            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
              <Tag size={12} className="text-zinc-500" />
              <select className="bg-transparent text-[10px] font-black uppercase text-zinc-400 outline-none" onChange={(e) => setFiltroEtiqueta(e.target.value)}>
                <option value="">Todas las etiquetas</option>
                {etiquetasDisponibles.map(t => <option key={t.nombre} value={t.nombre}>{t.nombre}</option>)}
              </select>
            </div>

            <button onClick={() => { setVerDespachados(!verDespachados); setVerArchivados(false); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${verDespachados ? 'bg-heraco text-black border-heraco' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}>
               <Zap size={14}/> {verDespachados ? 'Ver Pipeline' : 'Ver Despachos'}
            </button>

            <button onClick={() => { setVerArchivados(!verArchivados); setVerDespachados(false); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${verArchivados ? 'bg-heraco text-black border-heraco' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}>
              {verArchivados ? <ArchiveRestore size={14}/> : <Archive size={14}/>} {verArchivados ? 'Ver Activos' : 'Ver Archivo'}
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setMostrarModalColumna(true)} className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <Layout size={18}/> Añadir Fase
          </button>
          <button 
            onClick={() => {
              setNuevoProyecto({...nuevoProyecto, estado: columnas.length > 0 ? columnas[0].titulo : 'Pendiente'});
              setMostrarModalProyecto(true);
            }} 
            className="bg-heraco text-black font-black py-3 px-6 rounded-2xl flex items-center gap-2 hover:scale-105 transition-all text-xs"
          >
            <Plus size={16} /> NUEVA FICHA
          </button>
          <button onClick={() => setMostrarEditorEtiquetas(true)} className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-heraco transition-all">
            <Settings size={20}/>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 flex gap-6 custom-scrollbar">
        {!verArchivados && !verDespachados ? (
            columnas.map((col) => {
                const proyectosColumna = proyectos
                    .filter(p => p.estado === col.titulo)
                    .filter(p => filtroEtiqueta === '' || p.etiquetas?.some(t => t.nombre === filtroEtiqueta));

                return (
                    <div key={col.id} className="bg-zinc-900/20 border border-zinc-800/40 rounded-3xl w-85 shrink-0 flex flex-col h-full snap-start" onDragOver={(e) => e.preventDefault()} onDrop={async (e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData('idProyecto');
                        setProyectos(prev => prev.map(p => p.id === id ? { ...p, estado: col.titulo } : p));
                        await supabase.from('proyectos').update({ estado: col.titulo }).eq('id', id);
                    }}>
                        <div className="p-5 flex justify-between items-center bg-zinc-900/40 rounded-t-3xl border-b border-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <h3 className="font-black uppercase text-[10px] tracking-widest text-zinc-500 italic">{col.titulo}</h3>
                                <span className="text-heraco text-[10px] font-black bg-black px-2 py-0.5 rounded-lg border border-heraco/20">{proyectosColumna.length}</span>
                            </div>
                            <button onClick={() => eliminarColumna(col.id, col.titulo)} className="text-zinc-600 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                            {proyectosColumna.map(proyecto => renderFicha(proyecto))}
                        </div>
                    </div>
                );
            })
        ) : (
            <div className="bg-zinc-900/10 border border-zinc-800/40 rounded-3xl flex-1 flex flex-col h-full mx-auto max-w-7xl animate-in fade-in duration-500">
                <div className="p-6 flex justify-between items-center bg-zinc-900/30 rounded-t-3xl border-b border-zinc-800/50">
                    <div className="flex items-center gap-3">
                        {verArchivados ? <Archive className="text-heraco" size={20} /> : <Zap className="text-heraco" size={20} />}
                        <h3 className="font-black uppercase text-xs tracking-widest text-zinc-400 italic">
                            {verArchivados ? 'Historial de Trabajos Archivados' : 'Control de Envíos Despachados'}
                        </h3>
                        <span className="text-heraco text-xs font-black bg-black px-3 py-1 rounded-xl border border-heraco/20">{proyectos.length} Fichas</span>
                    </div>
                </div>
                <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 custom-scrollbar">
                    {proyectos.filter(p => filtroEtiqueta === '' || p.etiquetas?.some(t => t.nombre === filtroEtiqueta)).map(p => renderFicha(p))}
                </div>
            </div>
        )}
      </div>

      {/* --- MODALES --- */}
      {mostrarModalColumna && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-110 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-4xl p-8 shadow-2xl relative">
                <button onClick={() => setMostrarModalColumna(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={20}/></button>
                <h2 className="text-xl font-black uppercase italic text-heraco mb-6 tracking-tighter">Nueva Fase</h2>
                <form onSubmit={agregarNuevaColumna} className="space-y-4">
                    <input autoFocus className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-heraco outline-none font-bold uppercase text-xs" placeholder="EJ: PRODUCCIÓN" value={nuevaColumnaTitulo} onChange={e => setNuevaColumnaTitulo(e.target.value)} />
                    <button type="submit" className="w-full bg-heraco text-black font-black py-4 rounded-xl uppercase text-[10px] tracking-widest hover:scale-105 transition-all">Añadir fase al pipeline</button>
                </form>
            </div>
        </div>
      )}

      {mostrarModalProyecto && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-4xl p-8 shadow-2xl relative">
            <button onClick={() => setMostrarModalProyecto(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <h2 className="text-2xl font-black uppercase italic text-heraco mb-6">Nuevo Proyecto</h2>
            <form onSubmit={agregarProyecto} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-4 mb-2 block tracking-widest">Nombre del Proyecto</label>
                <input required className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-heraco outline-none font-bold" value={nuevoProyecto.nombre} onChange={e => setNuevoProyecto({...nuevoProyecto, nombre: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-4 mb-2 block tracking-widest">Cliente / Marca</label>
                <input required className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-heraco outline-none font-bold uppercase" value={nuevoProyecto.cliente} onChange={e => setNuevoProyecto({...nuevoProyecto, cliente: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-heraco text-black font-black py-5 rounded-2xl uppercase text-xs tracking-widest hover:scale-[1.02] transition-all mt-4">CREAR FICHA</button>
            </form>
          </div>
        </div>
      )}

      {/* --- EXPEDIENTE COMPLETO --- */}
      {proyectoSeleccionado && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-5xl max-h-[95vh] rounded-[2.5rem] border border-zinc-800 overflow-hidden flex flex-col lg:flex-row shadow-2xl">
            
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative">
              <header className="mb-8">
                <div className="flex items-center gap-3 text-heraco mb-2"><FileText size={18} /><span className="text-xs font-black uppercase tracking-widest italic">Expediente de Proyecto</span></div>
                <input className="bg-transparent text-4xl font-black uppercase italic tracking-tighter w-full outline-none focus:text-heraco transition-colors" value={proyectoSeleccionado.nombre} onChange={(e) => setProyectoSeleccionado({...proyectoSeleccionado, nombre: e.target.value})} onBlur={() => guardarCambiosProyecto({ nombre: proyectoSeleccionado.nombre })} />
                <p className="text-zinc-500 text-xs font-bold mt-1">Status: <span className="text-heraco italic underline uppercase font-black">{proyectoSeleccionado.estado}</span></p>
              </header>

              <div className="bg-black/40 border border-zinc-800 rounded-3xl p-6 mb-8 flex flex-col md:flex-row items-center gap-6">
                <div className="bg-heraco/10 p-4 rounded-2xl text-heraco shadow-[0_0_15px_rgba(203,222,32,0.2)]"><Info /></div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-8 flex-1">
                  <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Cliente</p><p className="text-sm font-bold text-zinc-200">{cotizacionPreview?.clientes?.empresa || proyectoSeleccionado.cliente}</p></div>
                  <div><p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Cotizó</p><p className="text-sm font-bold text-heraco">{cotizacionPreview?.perfiles?.nombre || proyectoSeleccionado.creado_por || nombreUsuarioActual}</p></div>
                  <div>
                    <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Referencia</p>
                    {(proyectoSeleccionado.cotizacion_id || proyectoSeleccionado.venta_id) ? (
                        <button onClick={() => verCotizacionRapida(proyectoSeleccionado.cotizacion_id || proyectoSeleccionado.venta_id || '', !!proyectoSeleccionado.venta_id && !proyectoSeleccionado.cotizacion_id)} className="flex items-center gap-2 text-heraco text-[10px] font-black hover:scale-105 transition-all uppercase italic">
                            {cargandoCot ? <Loader2 size={12} className="animate-spin"/> : <FileText size={12}/>} Vista Rápida
                        </button>
                    ) : (
                        <p className="text-[10px] font-bold text-zinc-600">Creado Manualmente</p>
                    )}
                  </div>
                </div>
              </div>

              {/* TÍTULO DINÁMICO TICKET O COTIZACIÓN */}
              {cotizacionPreview && (
                <div className="mb-10 bg-heraco/5 border border-heraco/20 rounded-3xl p-6 animate-in slide-in-from-top duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-black uppercase text-heraco italic">Desglose de {cotizacionPreview.isTicket ? 'Ticket POS' : 'Cotización'} #{cotizacionPreview.folio}</h4>
                        <button onClick={() => setCotizacionPreview(null)} className="text-zinc-500 hover:text-white"><X size={16}/></button>
                    </div>
                    <div className="space-y-2">
                        {cotizacionPreview.items_cotizacion?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-[11px] border-b border-zinc-800/50 pb-2">
                                <span className="text-zinc-300 font-bold uppercase">{item.cantidad}x {item.servicios?.nombre || 'MATERIAL/SERVICIO'}</span>
                                <span className="text-white font-black">${item.total_item.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>

                    {/* BLOQUE DE PAGOS Y LIQUIDACIÓN EN LA VISTA RÁPIDA */}
                    {!cotizacionPreview.isTicket && (
                        <div className="mt-4 border-t border-zinc-800/50 pt-4">
                            <div className="flex justify-between items-center text-[11px] pb-2">
                                <span className="text-zinc-500 font-bold uppercase">Total del Pedido</span>
                                <span className="text-white font-black">${cotizacionPreview.total?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] pb-2">
                                <span className="text-zinc-500 font-bold uppercase">Abonado</span>
                                <span className="text-white font-black">${(cotizacionPreview.abonado || 0)?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-red-400 font-bold uppercase">Resta por Pagar</span>
                                <span className="text-red-400 font-black">${(cotizacionPreview.total - (cotizacionPreview.abonado || 0))?.toLocaleString()}</span>
                            </div>

                            {(cotizacionPreview.total - (cotizacionPreview.abonado || 0) > 0) && (
                                <button 
                                  onClick={() => {
                                    setMontoPago(Number((cotizacionPreview.total - (cotizacionPreview.abonado || 0)).toFixed(2)));
                                    setMostrarModalPago(true);
                                  }} 
                                  className="w-full mt-4 bg-heraco text-black font-black py-3 rounded-xl uppercase text-[10px] tracking-widest hover:scale-[1.02] transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                  <Banknote size={16}/> Registrar Pago / Liquidar
                                </button>
                            )}
                        </div>
                    )}
                </div>
              )}

              {proyectoSeleccionado.checklist_procesos && proyectoSeleccionado.checklist_procesos.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-black uppercase text-heraco mb-4 flex items-center gap-2 italic"><ListChecks size={16} /> Procesos de Producción</h3>
                  <div className="space-y-4">
                    {proyectoSeleccionado.checklist_procesos.map((grupo, gIdx) => (
                      <div key={gIdx} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
                        <h4 className="text-xs font-bold text-zinc-300 uppercase mb-3 border-b border-zinc-800 pb-2">{grupo.producto}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {grupo.procesos.map((proc, pIdx) => (
                             <div key={pIdx} onClick={() => toggleProcesoChecklist(gIdx, pIdx)} className="flex items-center gap-3 bg-black p-3 rounded-xl border border-zinc-800 cursor-pointer hover:border-heraco transition-colors">
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${proc.completado ? 'bg-heraco border-heraco text-black' : 'border-zinc-600'}`}>
                                  {proc.completado && <Check size={14} className="font-black" />}
                                </div>
                                <span className={`text-xs font-bold uppercase ${proc.completado ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>{proc.nombre}</span>
                             </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4 text-zinc-400"><AlignLeft size={18} /><h3 className="font-black uppercase text-xs italic tracking-widest">Descripción del Proyecto</h3></div>
                <textarea className="w-full bg-black border border-zinc-800 rounded-3xl p-6 text-sm text-zinc-300 outline-none focus:border-heraco h-40 transition-all resize-none shadow-inner" value={proyectoSeleccionado.descripcion || ''} onChange={(e) => setProyectoSeleccionado({...proyectoSeleccionado, descripcion: e.target.value})} onBlur={() => guardarCambiosProyecto({ descripcion: proyectoSeleccionado.descripcion })} />
              </div>

              {proyectoSeleccionado.se_enviara && (
                <div className="mb-10 bg-black/40 border border-zinc-800 rounded-3xl p-8 shadow-inner border-l-4 border-l-heraco animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 mb-6 text-heraco"><Zap size={18} /><h3 className="font-black uppercase text-xs italic tracking-widest">Logística de Envío</h3></div>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[9px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">Repartidor Asignado</label>
                      <select className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-xs font-bold text-zinc-300 outline-none focus:border-heraco cursor-pointer" value={proyectoSeleccionado.encargado_envio || ''} onChange={(e) => guardarCambiosProyecto({ encargado_envio: e.target.value })}>
                        <option value="">Seleccionar empleado responsable...</option>
                        {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                      </select>
                    </div>

                    <div className="border-t border-zinc-800/50 pt-6">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-[9px] font-black text-zinc-500 uppercase ml-2 block tracking-widest items-center gap-2"><MapPin size={12}/> Dirección de Destino</label>
                        {clienteData && <span className="text-[9px] bg-zinc-900 px-2 py-1 rounded text-zinc-400 font-bold border border-zinc-800">🏢 Cliente vinculado: {clienteData.empresa || clienteData.nombre_contacto}</span>}
                      </div>
                      
                      <select className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-xs font-bold text-zinc-300 outline-none focus:border-heraco cursor-pointer mb-3" value={tipoDireccion} onChange={(e) => manejarCambioDireccion(e.target.value)}>
                        <option value="">¿A dónde se enviará el paquete?</option>
                        {clienteData?.sucursales?.map((sucursal: Sucursal, idx: number) => (
                          <option key={idx} value={idx.toString()}>📍 {sucursal.nombre} - {sucursal.direccion.substring(0, 40)}...</option>
                        ))}
                        <option value="manual">➕ Excepción / Escribir otra dirección nueva</option>
                      </select>

                      {tipoDireccion !== '' && tipoDireccion !== 'manual' && proyectoSeleccionado.direccion && (
                        <div className="bg-heraco/10 border border-heraco/20 p-4 rounded-xl flex items-start gap-3 animate-in zoom-in-95">
                           <MapPin size={16} className="text-heraco mt-0.5 shrink-0"/>
                           <div><p className="text-xs font-bold text-heraco leading-tight">{proyectoSeleccionado.direccion}</p>{proyectoSeleccionado.coordenadas && <p className="text-[9px] text-heraco/70 mt-1">{proyectoSeleccionado.coordenadas}</p>}</div>
                        </div>
                      )}

                      {tipoDireccion === 'manual' && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2">
                          <input className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-zinc-300 outline-none focus:border-heraco" placeholder="Escribe la dirección exacta..." value={proyectoSeleccionado.direccion || ''} onChange={(e) => setProyectoSeleccionado({...proyectoSeleccionado, direccion: e.target.value})} onBlur={() => guardarCambiosProyecto({ direccion: proyectoSeleccionado.direccion })} />
                          <div className="w-full h-32 rounded-lg overflow-hidden border border-zinc-800 relative z-0 group">
                            <button type="button" onClick={() => setMapaExpandido(true)} className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                              <Maximize2 className="text-heraco mb-2" size={32} />
                              <span className="text-white font-bold tracking-wider text-xs">FIJAR PUNTO EN EL MAPA</span>
                            </button>
                            <MapContainer center={[17.0654, -96.7236]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }} zoomControl={false} dragging={false}>
                              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                              {proyectoSeleccionado.coordenadas && <Marker position={[parseFloat(proyectoSeleccionado.coordenadas.split(',')[0]), parseFloat(proyectoSeleccionado.coordenadas.split(',')[1])]} icon={heracoPin} />}
                            </MapContainer>
                          </div>
                          {clienteData && proyectoSeleccionado.direccion && (
                            <button onClick={guardarNuevaSucursalCliente} className="w-full mt-2 bg-zinc-800 text-zinc-300 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-heraco hover:text-black transition-colors flex justify-center items-center gap-2 border border-zinc-700">
                              <Plus size={14}/> Guardar en el directorio de {clienteData.empresa || clienteData.nombre_contacto}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <button onClick={realizarEnvioDirecto} className="w-full bg-heraco text-black font-black py-4 rounded-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-heraco/10 uppercase text-xs tracking-widest mt-6">Confirmar y Despachar Orden</button>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xs font-black uppercase text-heraco mb-6 flex items-center gap-2 italic"><CheckCircle2 size={16} /> Tareas Asignadas</h3>
                <div className="space-y-3 mb-6">
                  {tareasProyecto.map(t => (
                    <div key={t.id} className="bg-black/60 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center group hover:border-heraco/30 transition-all">
                      <div><p className="font-bold text-sm text-zinc-200">{t.titulo}</p>
                        <div className="flex gap-4 mt-1">
                          <span className="text-[9px] font-black uppercase text-heraco flex items-center gap-1"><User size={10}/> {usuarios.find(u => u.id === t.id_asignado)?.nombre}</span>
                          <span className="text-[9px] font-black uppercase text-zinc-600 flex items-center gap-1"><CalendarIcon size={10}/> {t.fecha_limite || 'S/F'}</span>
                        </div>
                      </div>
                      <CheckCircle2 size={20} className="text-zinc-800 group-hover:text-heraco transition-colors" />
                    </div>
                  ))}
                </div>
                <form onSubmit={asignarTarea} className="bg-zinc-800/40 p-5 rounded-3xl border border-dashed border-zinc-700 grid grid-cols-1 md:grid-cols-12 gap-3 shadow-lg">
                  <input required className="md:col-span-6 bg-black border border-zinc-800 rounded-xl p-3 text-xs font-bold" placeholder="¿Qué sigue?" value={nuevaTarea.titulo} onChange={e => setNuevaTarea({...nuevaTarea, titulo: e.target.value})} />
                  <select required className="md:col-span-3 bg-black border border-zinc-800 rounded-xl p-3 text-xs font-bold outline-none" value={nuevaTarea.id_asignado} onChange={e => setNuevaTarea({...nuevaTarea, id_asignado: e.target.value})}>
                    <option value="">Para...</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                  <button type="submit" className="md:col-span-3 bg-heraco text-black font-black p-3 rounded-xl uppercase text-[10px] tracking-widest">Asignar</button>
                </form>
              </div>
            </div>

            {/* BARRA LATERAL DEL EXPEDIENTE */}
            <div className="w-full lg:w-80 bg-zinc-950/50 border-l border-zinc-800 p-8 space-y-8 overflow-y-auto custom-scrollbar relative z-10">
              <button onClick={() => setProyectoSeleccionado(null)} className="w-full bg-zinc-800 p-3 rounded-xl text-zinc-500 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest">Cerrar Expediente</button>
              
              {!proyectoSeleccionado.archivado && (
                <button onClick={finalizarTrabajo} className="w-full bg-heraco text-black p-4 rounded-2xl hover:scale-105 transition-all font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(203,222,32,0.2)]">Finalizar Trabajo</button>
              )}

              <div>
                <h4 className="text-[10px] font-black uppercase text-zinc-600 mb-4 tracking-widest flex justify-between items-center">Etiquetas <button onClick={() => setMostrarEditorEtiquetas(true)} className="text-heraco hover:scale-110"><Settings size={12}/></button></h4>
                <div className="flex flex-wrap gap-2">
                  {etiquetasDisponibles.map(tag => {
                    const activa = proyectoSeleccionado.etiquetas?.some(t => t.nombre === tag.nombre);
                    return <button key={tag.nombre} onClick={() => toggleEtiquetaEnProyecto(tag)} className={`text-[9px] font-black px-3 py-2 rounded-lg border ${activa ? 'text-black font-bold' : 'border-zinc-800 text-zinc-500'}`} style={{ backgroundColor: activa ? tag.color : 'transparent' }}>{tag.nombre}</button>
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black uppercase text-zinc-600 mb-4 tracking-widest flex items-center gap-2"><ImageIcon size={14}/> Portada de Ficha</h4>
                <input placeholder="URL de imagen..." className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-[10px] font-bold text-zinc-400 outline-none focus:border-heraco" value={proyectoSeleccionado.portada_url || ''} onChange={(e) => setProyectoSeleccionado({...proyectoSeleccionado, portada_url: e.target.value})} onBlur={() => guardarCambiosProyecto({ portada_url: proyectoSeleccionado.portada_url })} />
              </div>

              <div className="pt-8 border-t border-zinc-800 space-y-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group cursor-pointer" onClick={() => guardarCambiosProyecto({ se_enviara: !proyectoSeleccionado.se_enviara })}>
                  <div className="flex items-center gap-2 text-zinc-400 group-hover:text-heraco transition-colors">
                    <Zap size={14} className={proyectoSeleccionado.se_enviara ? 'text-heraco' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Se enviará</span>
                  </div>
                  <button className={`w-10 h-5 rounded-full transition-all relative flex items-center ${proyectoSeleccionado.se_enviara ? 'bg-heraco shadow-[0_0_10px_rgba(203,222,32,0.3)]' : 'bg-zinc-700'}`}>
                    <div className={`w-3 h-3 bg-black rounded-full shadow-md transition-all absolute ${proyectoSeleccionado.se_enviara ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <button onClick={() => eliminarFicha(proyectoSeleccionado.id)} className="w-full text-left p-4 rounded-2xl text-red-500 hover:bg-red-500/10 text-[10px] font-black uppercase flex items-center gap-3 transition-all border border-transparent hover:border-red-500/20"><Trash2 size={16}/> Eliminar ficha</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL MAPA --- */}
      {mapaExpandido && proyectoSeleccionado && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="p-6 flex justify-between items-center bg-zinc-950 border-b border-zinc-800">
            <div>
              <h2 className="text-2xl font-black uppercase text-heraco">Fijar Punto de Entrega</h2>
              <p className="text-zinc-500 text-sm">Haz clic en el mapa para colocar el pin. Las coordenadas se guardarán al cerrar.</p>
            </div>
            <button onClick={() => { setMapaExpandido(false); guardarCambiosProyecto({ coordenadas: proyectoSeleccionado.coordenadas }); }} className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-300">Confirmar y Cerrar</button>
          </div>
          <div className="flex-1 relative z-0">
            <MapContainer center={[17.0654, -96.7236]} zoom={14} style={{ height: '100%', width: '100%', zIndex: 0 }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <ClicEnMapa setCoordenadas={(coords) => setProyectoSeleccionado({...proyectoSeleccionado, coordenadas: coords})} />
            </MapContainer>
          </div>
        </div>
      )}

      {/* --- MODAL ETIQUETAS --- */}
      {mostrarEditorEtiquetas && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-110 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-4xl p-8 shadow-2xl relative">
            <button onClick={() => setMostrarEditorEtiquetas(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X /></button>
            <h2 className="text-xl font-black uppercase italic text-heraco tracking-tighter mb-6">Etiquetas de Agencia</h2>
            <div className="flex gap-2 mb-8">
              <input type="color" className="w-12 h-12 rounded-xl bg-transparent cursor-pointer border border-zinc-800" value={nuevaTag.color} onChange={e => setNuevaTag({...nuevaTag, color: e.target.value})} />
              <input className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 font-bold text-sm uppercase focus:border-heraco outline-none" placeholder="Nombre..." value={nuevaTag.nombre} onChange={e => setNuevaTag({...nuevaTag, nombre: e.target.value})} />
              <button onClick={async () => { if(nuevaTag.nombre) { await supabase.from('etiquetas_agencia').insert([nuevaTag]); setNuevaTag({nombre:'', color:'#CBDE20'}); traerTablero(); } }} className="bg-heraco text-black p-3 rounded-xl hover:scale-105 transition-all"><Plus size={20}/></button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {etiquetasDisponibles.map((tag: any) => (
                <div key={tag.id} className="flex justify-between items-center bg-black p-3 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }}></div>
                    <span className="text-xs font-black uppercase tracking-widest">{tag.nombre}</span>
                  </div>
                  <button onClick={async () => { if(window.confirm("¿Borrar etiqueta?")) { await supabase.from('etiquetas_agencia').delete().eq('id', tag.id); traerTablero(); } }} className="text-zinc-600 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL REGISTRAR PAGO DESDE TABLERO --- */}
      {mostrarModalPago && cotizacionPreview && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-120 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl relative">
            <button onClick={() => setMostrarModalPago(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase italic text-white mb-2">Abonar a Cuenta</h2>
            <p className="text-xs text-zinc-400 font-bold mb-6 truncate">Proyecto: {proyectoSeleccionado?.nombre}</p>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-6 grid grid-cols-2 gap-4">
              <div><p className="text-[9px] uppercase font-black text-zinc-500">Resta</p><p className="text-2xl font-black text-red-400">${(cotizacionPreview.total - (cotizacionPreview.abonado || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
              <div className="text-right"><p className="text-[9px] uppercase font-black text-zinc-500">Abonado</p><p className="text-sm font-bold text-zinc-300">${(cotizacionPreview.abonado || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
            </div>

            <form onSubmit={procesarPagoDesdeTablero}>
              <div className="mb-6">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">Monto a Pagar</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-heraco font-black text-xl">$</span>
                  <input type="number" step="0.01" max={cotizacionPreview.total - (cotizacionPreview.abonado || 0)} required className="w-full bg-black border border-heraco/50 rounded-xl p-4 pl-10 text-white focus:border-heraco outline-none font-black text-xl" value={montoPago} onChange={e => setMontoPago(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                <button type="button" onClick={() => setMetodoPagoStr('Efectivo')} className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-[9px] font-black uppercase ${metodoPagoStr === 'Efectivo' ? 'bg-heraco/10 border-heraco text-heraco' : 'bg-black border-zinc-800 text-zinc-500'}`}><Banknote size={16} className="mb-1"/> Efectivo</button>
                <button type="button" onClick={() => setMetodoPagoStr('Tarjeta')} className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-[9px] font-black uppercase ${metodoPagoStr === 'Tarjeta' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-black border-zinc-800 text-zinc-500'}`}><CreditCard size={16} className="mb-1"/> Tarjeta</button>
                <button type="button" onClick={() => setMetodoPagoStr('Transferencia')} className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-[9px] font-black uppercase ${metodoPagoStr === 'Transferencia' ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-black border-zinc-800 text-zinc-500'}`}><Smartphone size={16} className="mb-1"/> Transf</button>
              </div>

              <button type="submit" className="w-full bg-heraco text-black font-black py-4 rounded-xl uppercase text-sm tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-lg"><CheckCircle2 size={20}/> Registrar Pago</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}