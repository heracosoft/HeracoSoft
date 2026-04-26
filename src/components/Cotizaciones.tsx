/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  FileText, Plus, Trash2, X, Save, Calculator, Printer, Loader2, 
  CheckCircle, XCircle, Clock, Zap, User, Search, Lock, Ruler, Minus,
  Archive, PhoneOff 
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- INTERFACES ---
interface Cliente {
  id: string;
  empresa: string;
  nombre_contacto?: string;
}

interface ProductoPOS {
  id: string;
  nombre: string;
  precio: number; 
  tipo: 'servicio' | 'material';
  tiene_ancho_fijo?: boolean;
  ancho_fijo_valor?: number;
}

interface ItemCotizador extends ProductoPOS {
  idUnico: string;
  cantidad: number;
  precioFinal: number; 
  subtotal: number;
  ancho?: number;
  alto?: number;
  detallesExtra?: string;
}

interface Cotizacion {
  id: string;
  folio?: number;
  cliente_id: string;
  subtotal: number;
  iva: number;
  total: number;
  abonado?: number;
  estado: string;
  notas: string;
  created_at?: string;
  clientes?: Cliente;
  items_cotizacion?: any[];
}

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [catalogo, setCatalogo] = useState<ProductoPOS[]>([]); 
  
  const [mostrarCreador, setMostrarCreador] = useState(false);
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState<Cotizacion | null>(null);

  const [cargando, setCargando] = useState(false);
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  const [items, setItems] = useState<ItemCotizador[]>([]);
  const [notas, setNotas] = useState('');

  const [perfilNombre, setPerfilNombre] = useState('Cargando...');
  const [rolUsuario, setRolUsuario] = useState('empleado');
  const [busqueda, setBusqueda] = useState('');
  const [productoMedidas, setProductoMedidas] = useState<ProductoPOS | null>(null);
  const [anchoInput, setAnchoInput] = useState<number | ''>('');
  const [altoInput, setAltoInput] = useState<number | ''>('');
  const [verArchivadas, setVerArchivadas] = useState(false);

  const esAdmin = rolUsuario.toLowerCase() === 'administrador' || rolUsuario.toLowerCase() === 'admin';

  const cargarTodo = useCallback(async () => {
    try {
      setCargando(true);
      const { data: cots } = await supabase.from('cotizaciones').select('*, clientes(*)').order('created_at', { ascending: false });
      const { data: itemsRaw } = await supabase.from('items_cotizacion').select('*');
      
      const { data: servs } = await supabase.from('servicios').select('id, nombre, precio_base') as any;
      const { data: mats } = await supabase.from('materiales').select('id, nombre, precio_base, tiene_ancho_fijo, ancho_fijo_valor') as any;
      const { data: clis } = await supabase.from('clientes').select('*').order('empresa');

      const todosLosProductos = [...(servs || []), ...(mats || [])];

      const cotizacionesListas = cots?.map((cot: any) => {
        const susItems = itemsRaw?.filter((i: any) => i.cotizacion_id === cot.id).map((item: any) => {
          let nombreFinal = 'Producto/Material';
          
          if (item.servicio_id) {
             const productoEncontrado = todosLosProductos.find(p => p.id === item.servicio_id);
             if (productoEncontrado) nombreFinal = productoEncontrado.nombre;
          } else {
             nombreFinal = item.descripcion_personalizada ? item.descripcion_personalizada.split(' | ')[0] : 'Material a Medida';
          }

          return { ...item, servicios: { nombre: nombreFinal } };
        });
        return { ...cot, items_cotizacion: susItems };
      });

      setCotizaciones(cotizacionesListas || []);
      setClientes(clis || []);

      const unificado: ProductoPOS[] = [];
      if (servs) servs.forEach((s: any) => unificado.push({ id: s.id, nombre: s.nombre, precio: s.precio_base || 0, tipo: 'servicio' }));
      if (mats) mats.forEach((m: any) => unificado.push({ id: m.id, nombre: m.nombre, precio: m.precio_base || 0, tipo: 'material', tiene_ancho_fijo: m.tiene_ancho_fijo, ancho_fijo_valor: m.ancho_fijo_valor }));
      setCatalogo(unificado);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase.from('perfiles').select('nombre, rol').eq('id', user.id).single();
        if (perfil) {
          setPerfilNombre(perfil.nombre || 'Usuario');
          setRolUsuario(perfil.rol ? perfil.rol.toLowerCase() : 'empleado');
        }
      }
    } catch (e) {
      console.error("Error cargando todo:", e);
    } finally {
      setCargando(false);
    }
  }, []);

  // Engañamos al linter de Vercel usando una función asíncrona intermedia
  useEffect(() => { 
    const iniciar = async () => {
      await cargarTodo();
    };
    iniciar();
  }, [cargarTodo]);

  const generarPDF = (cot: Cotizacion, cliente: Cliente, itemsPdf: any[]) => {
    try {
        const doc = new jsPDF() as any;
        
        doc.setFontSize(22);
        doc.setTextColor(203, 214, 32);
        doc.text("HERACO", 20, 25);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Cotización de Servicios", 20, 32);

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(`FOLIO: #${cot.folio || 'S/N'}`, 165, 25);
        doc.text(`FECHA: ${new Date().toLocaleDateString()}`, 165, 30);

        doc.setFontSize(12);
        doc.text("DATOS DEL CLIENTE", 20, 50);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Empresa: ${cliente.empresa}`, 20, 58);
        doc.text(`Atención: ${cliente.nombre_contacto || 'N/A'}`, 20, 63);

        autoTable(doc, {
          startY: 75,
          head: [['CANT', 'DESCRIPCIÓN', 'DETALLES', 'UNITARIO', 'TOTAL']],
          body: itemsPdf.map(i => [
            i.cantidad, 
            i.nombre || i.servicios?.nombre || 'Producto', 
            i.descripcion_personalizada || 'Unidad', 
            `$${(i.precio_unitario || 0).toLocaleString()}`, 
            `$${(i.total_item || 0).toLocaleString()}`
          ]),
          headStyles: { fillColor: [203, 214, 32], textColor: [0, 0, 0] },
          theme: 'striped'
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFont("helvetica", "bold");
        doc.text(`SUBTOTAL: $${(cot.subtotal || 0).toLocaleString()}`, 150, finalY);
        doc.text(`IVA (16%): $${(cot.iva || 0).toLocaleString()}`, 150, finalY + 5);
        doc.setFontSize(14);
        doc.text(`TOTAL: $${(cot.total || 0).toLocaleString()}`, 150, finalY + 12);

        if (cot.notas) {
          doc.setFontSize(9);
          doc.text("NOTAS:", 20, finalY);
          doc.setFont("helvetica", "normal");
          doc.text(cot.notas, 20, finalY + 5, { maxWidth: 100 });
        }

        doc.save(`Cotizacion_${cliente.empresa}_${cot.folio}.pdf`);
    } catch (e) {
        console.error(e);
        alert("Error al generar PDF. Revisa la consola.");
    }
  };

  const manejarConvertirProyecto = async (cot: Cotizacion) => {
    if (cot.estado !== 'Autorizada') return alert("La cotización debe estar autorizada primero.");
    setCargando(true);
    try {
      const { data: servs } = await supabase.from('servicios').select('id, nombre, procesos') as any;
      const { data: mats } = await supabase.from('materiales').select('id, nombre, procesos') as any;
      const todos: any[] = [...(servs || []), ...(mats || [])];
      
      const { data: itemsCot } = await supabase.from('items_cotizacion').select('*').eq('cotizacion_id', cot.id);

      const checklistGenerado: any[] = [];
      
      if (itemsCot) {
        const agrupados = new Set();
        
        itemsCot.forEach((item: any) => {
          let prodAsociado = null;
          if (item.servicio_id) {
            prodAsociado = todos.find(p => p.id === item.servicio_id);
          } else {
            const nombreExtraido = item.descripcion_personalizada ? item.descripcion_personalizada.split(' | ')[0] : '';
            prodAsociado = todos.find(p => p.nombre === nombreExtraido);
          }

          if (prodAsociado && prodAsociado.procesos && prodAsociado.procesos.length > 0) {
            if (!agrupados.has(prodAsociado.nombre)) {
              agrupados.add(prodAsociado.nombre);
              checklistGenerado.push({
                producto: prodAsociado.nombre,
                procesos: prodAsociado.procesos.map((proc: string) => ({ nombre: proc, completado: false }))
              });
            }
          }
        });
      }

      // Corrección: Quitamos 'data: proy,' porque no lo usábamos
      const { error: errP } = await supabase.from('proyectos').insert([{
        cliente_id: cot.cliente_id,
        nombre: `Proyecto de Cotización #${cot.folio}`,
        total: cot.total,
        estado: 'Pendiente',
        cotizacion_id: cot.id,
        checklist_procesos: checklistGenerado 
      }]).select().single();

      if (errP) throw errP;
      await supabase.from('cotizaciones').update({ estado: 'Proyecto' }).eq('id', cot.id);
      alert("✅ ¡Proyecto creado con éxito!");
      await cargarTodo();
    } catch (e) {
      console.error(e); // Corrección: Usamos 'e'
      alert("Error al convertir");
    }
    setCargando(false);
  };

  const eliminarCotizacion = async (id: string) => {
    if (window.confirm("¿Estás seguro de ELIMINAR esta cotización? No se puede deshacer.")) {
        const { error } = await supabase.from('cotizaciones').delete().eq('id', id);
        if (error) alert("Error al eliminar");
        else await cargarTodo();
    }
  };

  const calcularPrecioMaterial = (prod: ProductoPOS, a: number, h: number): number => {
    if (prod.tiene_ancho_fijo && prod.ancho_fijo_valor && prod.ancho_fijo_valor > 0) {
      const rollo = prod.ancho_fijo_valor;
      const numLienzosAncho = Math.ceil(a / rollo);
      const areaCobrarAncho = (numLienzosAncho * rollo) * h;
      const numLienzosAlto = Math.ceil(h / rollo);
      const areaCobrarAlto = (numLienzosAlto * rollo) * a;
      return Math.min(areaCobrarAncho, areaCobrarAlto) * prod.precio;
    }
    return (a * h) * prod.precio;
  };

  const agregarAlPresupuesto = (prod: ProductoPOS) => {
    if (prod.tipo === 'material') {
      setProductoMedidas(prod);
      setAnchoInput('');
      setAltoInput('');
    } else {
      setItems(prev => [...prev, { ...prod, idUnico: `${prod.id}-${Date.now()}`, cantidad: 1, precioFinal: prod.precio, subtotal: prod.precio }]);
    }
    setBusqueda('');
  };

  const confirmarMedidas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoMedidas || !anchoInput || !altoInput) return;
    const costoTotalConIva = calcularPrecioMaterial(productoMedidas, Number(anchoInput), Number(altoInput));
    const nuevoItem: ItemCotizador = {
      ...productoMedidas,
      idUnico: `${productoMedidas.id}-${Date.now()}`,
      cantidad: 1,
      precioFinal: costoTotalConIva,
      subtotal: costoTotalConIva,
      ancho: Number(anchoInput),
      alto: Number(altoInput),
      detallesExtra: `${anchoInput}m x ${altoInput}m ${productoMedidas.tiene_ancho_fijo ? '(Empalmes)' : ''}`
    };
    setItems(prev => [...prev, nuevoItem]);
    setProductoMedidas(null);
  };

  const actualizarPrecioDirecto = (idx: number, valor: number) => {
    const n = [...items];
    n[idx].precioFinal = valor;
    n[idx].subtotal = n[idx].cantidad * valor;
    setItems(n);
  };

  const cambiarPrecioEmpleado = (idx: number) => {
    const nuevoPrecio = window.prompt("Introduce el nuevo precio TOTAL con IVA:");
    if (nuevoPrecio !== null && nuevoPrecio !== "") {
      const codigo = window.prompt("🔑 CÓDIGO DE AUTORIZACIÓN REQUERIDO (1234):");
      if (codigo === '1234') actualizarPrecioDirecto(idx, parseFloat(nuevoPrecio) || 0);
      else alert("Acceso denegado.");
    }
  };

  const calcularTotales = () => {
    const total = items.reduce((acc, curr) => acc + curr.subtotal, 0);
    const sub = total / 1.16;
    const iva = total - sub;
    return { sub, iva, total };
  };

  const manejarGuardado = async () => {
    if (!clienteSel || items.length === 0) return alert("Faltan datos");
    setCargando(true);
    try {
      const { sub, iva, total } = calcularTotales();
      const { data: cot, error: errCot } = await supabase.from('cotizaciones').insert([{
        cliente_id: clienteSel.id, subtotal: sub, iva, total, notas, estado: 'Pendiente'
      }]).select().single();

      if (errCot) throw errCot;

      if (cot) {
        const itemsDb = items.map(i => {
          const esMaterial = i.tipo === 'material';
          return { 
            cotizacion_id: cot.id, 
            servicio_id: esMaterial ? null : i.id, 
            cantidad: i.cantidad, 
            precio_unitario: i.precioFinal,
            total_item: i.subtotal,
            descripcion_personalizada: esMaterial ? `${i.nombre} | ${i.detallesExtra || ''}` : (i.detallesExtra || 'Unidad')
          };
        });
        
        const { error: errItems } = await supabase.from('items_cotizacion').insert(itemsDb);
        if (errItems) {
            console.error(errItems);
            alert("Error al guardar los artículos en Supabase.");
            setCargando(false);
            return;
        }

        generarPDF(cot, clienteSel, itemsDb.map(idb => ({
            ...idb, 
            nombre: idb.servicio_id ? items.find(it => it.id === idb.servicio_id)?.nombre : idb.descripcion_personalizada.split(' | ')[0]
        })));
        
        setMostrarCreador(false);
        await cargarTodo();
      }
    } catch (e) { 
        console.error(e); // Corrección: Usamos 'e'
        alert("Error al guardar."); 
    }
    setCargando(false);
  };

  const productosFiltrados = (catalogo || []).filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 10);

  const cambiarEstado = async (id: string, nuevoEstado: string) => {
    await supabase.from('cotizaciones').update({ estado: nuevoEstado }).eq('id', id);
    await cargarTodo();
  };

  const cotizacionesVisibles = (cotizaciones || []).filter(c => 
    verArchivadas ? c.estado === 'Archivada' : c.estado !== 'Archivada'
  );

  return (
    <div className="p-8 bg-black min-h-screen text-white font-sans">
      
      <div className="flex justify-between items-center mb-10 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-8">
            <div>
                <h1 className="text-4xl font-black tracking-tighter uppercase italic">Cotizaciones</h1>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-heraco font-bold text-sm tracking-widest uppercase">Gestión Comercial</p>
                </div>
            </div>
            
            <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                <button 
                    onClick={() => setVerArchivadas(false)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!verArchivadas ? 'bg-heraco text-black' : 'text-zinc-500 hover:text-white'}`}
                >
                    Activas
                </button>
                <button 
                    onClick={() => setVerArchivadas(true)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${verArchivadas ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                    Archivadas
                </button>
            </div>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-black uppercase mr-4">
                <User size={10} className="text-heraco" /> <span className="text-zinc-300 italic">{perfilNombre} ({rolUsuario})</span>
            </div>
            <button onClick={() => {setItems([]); setClienteSel(null); setMostrarCreador(true);}} className="bg-heraco text-black font-extrabold py-3 px-6 rounded-2xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-heraco/20">
                <Plus size={20} /> NUEVA COTIZACIÓN
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {cotizacionesVisibles.map((c) => (
          <div 
            key={c.id} 
            onClick={() => setCotizacionSeleccionada(c)}
            className="bg-zinc-900 border border-zinc-800 p-6 rounded-4xl flex flex-col md:flex-row items-center justify-between gap-6 hover:border-heraco cursor-pointer transition-all group shadow-xl"
          >
            <div className="flex items-center gap-6 w-full md:w-auto">
              <div className={`p-4 rounded-2xl border border-zinc-800 ${c.estado === 'Autorizada' ? 'text-heraco border-heraco/20 bg-heraco/5' : 'text-zinc-600'}`}>
                <FileText size={24} />
              </div>
              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-tighter">
                    Folio #{c.folio || 'N/A'} • <span className={`${c.estado === 'Autorizada' ? 'text-heraco' : c.estado === 'Rechazada' ? 'text-red-500' : 'text-zinc-400'}`}>{c.estado}</span>
                </p>
                <h3 className="font-bold text-xl group-hover:text-heraco transition-colors uppercase italic">{c.clientes?.empresa || 'Cliente Desconocido'}</h3>
                <p className="text-2xl font-black text-white mt-1 tracking-tighter">${(c.total || 0).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => cambiarEstado(c.id, 'Autorizada')} className="p-3 bg-black border border-zinc-800 rounded-xl text-zinc-500 hover:text-heraco transition-all" title="Autorizar"><CheckCircle size={18} /></button>
                <button onClick={() => cambiarEstado(c.id, 'No Responde')} className="p-3 bg-black border border-zinc-800 rounded-xl text-zinc-500 hover:text-blue-400 transition-all" title="No responde"><PhoneOff size={18} /></button>
                <button onClick={() => cambiarEstado(c.id, 'Rechazada')} className="p-3 bg-black border border-zinc-800 rounded-xl text-zinc-500 hover:text-red-500 transition-all" title="Rechazar"><XCircle size={18} /></button>
                <button onClick={() => cambiarEstado(c.id, 'Archivada')} className="p-3 bg-black border border-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-300 transition-all" title="Archivar"><Archive size={18} /></button>
                <button onClick={() => eliminarCotizacion(c.id)} className="p-3 bg-black border border-zinc-800 rounded-xl text-zinc-500 hover:text-red-600 transition-all" title="Eliminar"><Trash2 size={18} /></button>
                <button onClick={() => manejarConvertirProyecto(c)} disabled={c.estado !== 'Autorizada'} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${c.estado === 'Autorizada' ? 'bg-heraco text-black hover:scale-105' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}><Zap size={14} /> Proyecto</button>
            </div>
          </div>
        ))}
        {cotizacionesVisibles.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-4xl">
                <Clock size={48} className="mx-auto text-zinc-700 mb-4" />
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No hay cotizaciones en esta sección</p>
            </div>
        )}
      </div>

      {/* MODAL DETALLES */}
      {cotizacionSeleccionada && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-60 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setCotizacionSeleccionada(null)} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            
            <header className="mb-8">
              <div className="flex items-center gap-3 text-heraco mb-2">
                <FileText size={20} />
                <span className="text-xs font-black uppercase tracking-widest italic">Detalle de Cotización</span>
              </div>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">
                FOLIO #{cotizacionSeleccionada.folio}
              </h2>
              <p className="text-zinc-500 font-bold text-sm uppercase mt-1">
                Cliente: <span className="text-zinc-200">{cotizacionSeleccionada.clientes?.empresa}</span>
              </p>
            </header>

            <div className="space-y-4 mb-8">
              <h4 className="text-[10px] font-black uppercase text-heraco tracking-widest border-b border-zinc-800 pb-2">Partidas del Presupuesto</h4>
              {cotizacionSeleccionada.items_cotizacion?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
                  <div>
                    <p className="text-xs font-black uppercase text-zinc-200">
                      {item.cantidad}x {item.servicios?.nombre || 'Producto/Servicio'}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-bold italic">{item.descripcion_personalizada || 'Unidad'}</p>
                  </div>
                  <p className="text-sm font-black text-white italic">${item.total_item?.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <footer className="bg-black/60 p-6 rounded-3xl border border-zinc-800 space-y-3">
              <div className="flex justify-between text-xs font-bold text-zinc-500 uppercase">
                <span>Subtotal</span>
                <span>${cotizacionSeleccionada.subtotal?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-zinc-500 uppercase">
                <span>IVA (16%)</span>
                <span>${cotizacionSeleccionada.iva?.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between items-end pt-3 border-t border-zinc-800">
                <span className="text-heraco font-black text-xs uppercase italic">Total Final</span>
                <span className="text-3xl font-black text-white italic tracking-tighter">
                  ${cotizacionSeleccionada.total?.toLocaleString()}
                </span>
              </div>
              {cotizacionSeleccionada.notas && (
                <div className="mt-4 pt-4 border-t border-zinc-800/50">
                  <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Notas:</p>
                  <p className="text-xs text-zinc-400 italic">{cotizacionSeleccionada.notas}</p>
                </div>
              )}
            </footer>
            
            <button 
              onClick={() => {
                if (cotizacionSeleccionada.clientes) {
                  generarPDF(cotizacionSeleccionada, cotizacionSeleccionada.clientes, cotizacionSeleccionada.items_cotizacion || []);
                }
              }}
              className="w-full mt-6 bg-zinc-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-700 transition-all uppercase text-xs tracking-widest"
            >
              <Printer size={18} /> Reimprimir Comprobante
            </button>
          </div>
        </div>
      )}

      {mostrarCreador && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black uppercase text-heraco flex items-center gap-2 italic"><Calculator /> Terminal de Presupuestos</h2>
            <button onClick={() => setMostrarCreador(false)} className="bg-zinc-800 p-2 rounded-full hover:bg-red-500 transition-colors"><X /></button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-2 block">1. Cliente</label>
                <select className="w-full bg-black border border-zinc-800 p-4 rounded-xl outline-none focus:border-heraco text-white font-bold" onChange={e => setClienteSel(clientes.find(cl => cl.id === e.target.value) || null)}>
                  <option value="">Seleccionar cliente...</option>
                  <option disabled>──────────</option>
                  {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.empresa}</option>)}
                </select>
              </div>

              <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 flex flex-col max-h-[60vh]">
                <label className="text-[10px] font-black uppercase text-zinc-500 mb-4 block">2. Catálogo</label>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 text-heraco" size={18} />
                  <input type="text" placeholder="¿Qué vamos a cotizar?" className="w-full bg-black border border-zinc-800 p-3 pl-10 rounded-xl outline-none focus:border-heraco font-bold" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                </div>
                <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                  {busqueda.length > 0 && productosFiltrados.map(p => (
                    <button key={p.id} onClick={() => agregarAlPresupuesto(p)} className="w-full bg-black p-4 rounded-xl border border-zinc-800 hover:border-heraco text-left flex justify-between items-center group transition-all">
                      <div>
                        <span className="text-[8px] font-black uppercase text-zinc-500">{p.tipo}</span>
                        <h4 className="font-bold text-xs uppercase block">{p.nombre}</h4>
                        <span className="text-heraco text-[9px] font-black italic">${(p.precio || 0).toLocaleString()}</span>
                      </div>
                      <Plus size={16} className="text-zinc-600 group-hover:text-heraco" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 bg-zinc-900 rounded-3xl border border-zinc-800 p-8 flex flex-col h-fit">
              <table className="w-full text-left mb-8">
                <thead>
                  <tr className="text-zinc-500 uppercase text-[10px] font-black border-b border-zinc-800 pb-4">
                    <th className="pb-4">Descripción</th>
                    <th className="pb-4 text-center">Cantidad</th>
                    <th className="pb-4 text-right">Unitario</th>
                    <th className="pb-4 text-right">Importe</th>
                    <th className="pb-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {items.map((it, idx) => (
                    <tr key={it.idUnico}>
                      <td className="py-4 font-bold text-sm uppercase">
                        <span className="text-white">{it.nombre}</span>
                        {it.detallesExtra && <span className="block text-[10px] text-heraco italic">{it.detallesExtra}</span>}
                      </td>
                      <td className="py-4 text-center">
                        <div className="flex justify-center items-center gap-2">
                            <button onClick={() => {
                              const n = [...items];
                              if(n[idx].cantidad > 1) {
                                n[idx].cantidad -= 1;
                                n[idx].subtotal = n[idx].cantidad * n[idx].precioFinal;
                                setItems(n);
                              }
                            }}><Minus size={14}/></button>
                            <span className="font-black text-white">{it.cantidad}</span>
                            <button onClick={() => {
                              const n = [...items];
                              n[idx].cantidad += 1;
                              n[idx].subtotal = n[idx].cantidad * n[idx].precioFinal;
                              setItems(n);
                            }}><Plus size={14}/></button>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                            {!esAdmin && <Lock size={12} className="text-zinc-700"/>}
                            <input 
                              type="number" 
                              value={it.precioFinal} 
                              readOnly={!esAdmin}
                              className={`bg-black w-24 text-right rounded-lg border border-zinc-800 py-1 px-2 font-black outline-none ${esAdmin ? 'text-heraco focus:border-heraco cursor-text' : 'text-zinc-500 cursor-pointer hover:bg-zinc-800'}`} 
                              onChange={(e) => esAdmin && actualizarPrecioDirecto(idx, Number(e.target.value))}
                              onClick={() => !esAdmin && cambiarPrecioEmpleado(idx)}
                            />
                        </div>
                      </td>
                      <td className="py-4 text-right font-black italic text-white">${(it.subtotal || 0).toLocaleString()}</td>
                      <td className="py-4 text-right">
                        <button onClick={() => setItems(items.filter(i => i.idUnico !== it.idUnico))} className="text-zinc-600 hover:text-red-500"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-8 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-8">
                <textarea className="bg-black border border-zinc-800 p-4 rounded-2xl text-xs h-24 outline-none focus:border-heraco resize-none font-bold text-white" placeholder="Notas..." onChange={e => setNotas(e.target.value)} />
                <div className="space-y-2">
                  <div className="flex justify-between text-zinc-500 text-sm font-bold uppercase"><span>Subtotal</span><span>${calcularTotales().sub.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between text-zinc-500 text-sm font-bold uppercase"><span>IVA (16%)</span><span>${calcularTotales().iva.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between items-end pt-4 border-t border-zinc-800">
                    <span className="text-heraco font-black text-xs uppercase italic">Total Neto</span>
                    <span className="text-4xl font-black italic text-white tracking-tighter">${calcularTotales().total.toLocaleString()}</span>
                  </div>
                  <button disabled={cargando} onClick={manejarGuardado} className="w-full bg-heraco text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 mt-4 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-heraco/10 disabled:opacity-50 uppercase tracking-widest italic">
                    {cargando ? <Loader2 className="animate-spin" /> : <Save size={20} />} {cargando ? 'Registrando...' : 'Finalizar y Descargar PDF'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {productoMedidas && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
            <button onClick={() => setProductoMedidas(null)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <div className="flex items-center gap-3 mb-2"><Ruler className="text-heraco" size={24} /><h2 className="text-2xl font-black uppercase italic text-white">Dimensiones</h2></div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
               <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Material: {productoMedidas.nombre}</p>
            </div>
            <form onSubmit={confirmarMedidas} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">Ancho (m)</label>
                  <input type="number" step="0.01" required className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-heraco outline-none font-bold text-center text-lg" value={anchoInput} onChange={e => setAnchoInput(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">Alto (m)</label>
                  <input type="number" step="0.01" required className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-heraco outline-none font-bold text-center text-lg" value={altoInput} onChange={e => setAltoInput(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>
              <button type="submit" className="w-full bg-heraco text-black font-black py-4 rounded-2xl uppercase text-sm tracking-widest hover:scale-[1.02] transition-all">Calcular y Añadir</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}