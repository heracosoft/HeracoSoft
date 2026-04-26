/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Search, Plus, Minus, Trash2, Printer, 
  CreditCard, Banknote, Smartphone, Lock, Unlock, X, ShoppingCart, Ruler, AlertCircle,
  Users, FileText, ArrowDownCircle, CheckCircle, Ticket, Percent, Key, ListOrdered
} from 'lucide-react';

interface ProductoPOS {
  id: string;
  nombre: string;
  precio: number;
  tipo: 'servicio' | 'material';
  tiene_ancho_fijo?: boolean;
  ancho_fijo_valor?: number;
  procesos?: string[]; 
}

interface ItemCarrito extends ProductoPOS {
  idUnico: string; 
  cantidad: number;
  subtotal: number;
  detallesExtra?: string; 
}

interface Turno {
  id: string;
  monto_apertura: number;
  estado: string;
  fecha_apertura: string;
}

interface Cliente {
  id: string;
  empresa: string;
}

interface CotizacionPendiente {
  id: string;
  folio: number;
  total: number;
  abonado: number;
  estado: string;
  clientes?: Cliente;
}

interface Cupon {
  id: string;
  codigo: string;
  tipo: 'porcentaje' | 'fijo';
  valor: number;
  fecha_expiracion?: string;
  limite_usos?: number;
  usos_actuales: number;
  compra_minima: number;
  activo: boolean;
}

export default function Caja() {
  // --- ESTADOS DE USUARIO ---
  const [rolUsuario, setRolUsuario] = useState('empleado');
  const esAdmin = rolUsuario === 'admin';

  // --- ESTADOS CAJA ---
  const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null);
  const [catalogo, setCatalogo] = useState<ProductoPOS[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [efectivoRecibido, setEfectivoRecibido] = useState<number | ''>('');
  const [cargando, setCargando] = useState(true);
  const [montoApertura, setMontoApertura] = useState<number | ''>('');

  // --- ESTADOS CLIENTES Y ENCARGOS MOSTRADOR ---
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [mostrarModalClientes, setMostrarModalClientes] = useState(false);
  const [nombreMostrador, setNombreMostrador] = useState('');
  const [telefonoMostrador, setTelefonoMostrador] = useState('');
  const [esAnticipo, setEsAnticipo] = useState(false);
  const [montoAnticipo, setMontoAnticipo] = useState<number | ''>('');
  
  // --- ESTADOS EGRESOS ---
  const [mostrarModalEgreso, setMostrarModalEgreso] = useState(false);
  const [egresoConcepto, setEgresoConcepto] = useState('');
  const [egresoMonto, setEgresoMonto] = useState<number | ''>('');

  // --- ESTADOS COTIZACIONES / ÓRDENES ---
  const [cotizacionesPendientes, setCotizacionesPendientes] = useState<CotizacionPendiente[]>([]);
  const [mostrarModalCotizaciones, setMostrarModalCotizaciones] = useState(false);
  const [cotizacionPagar, setCotizacionPagar] = useState<CotizacionPendiente | null>(null);
  const [montoAbono, setMontoAbono] = useState<number | ''>('');
  const [busquedaOrdenes, setBusquedaOrdenes] = useState('');

  // --- ESTADOS VENTAS DEL DÍA ---
  const [mostrarModalVentasDia, setMostrarModalVentasDia] = useState(false);
  const [ventasDia, setVentasDia] = useState<any[]>([]);

  // --- ESTADOS CALCULADORA DE MEDIDAS ---
  const [productoMedidas, setProductoMedidas] = useState<ProductoPOS | null>(null);
  const [ancho, setAncho] = useState<number | ''>('');
  const [alto, setAlto] = useState<number | ''>('');

  // --- ESTADOS OVERRIDE DE PRECIO (ADMIN) ---
  const [mostrarModalOverride, setMostrarModalOverride] = useState(false);
  const [itemAEditar, setItemAEditar] = useState<string | null>(null);
  const [nuevoPrecioOverride, setNuevoPrecioOverride] = useState<number | ''>('');
  const [pinAdminOverride, setPinAdminOverride] = useState('');

  // --- ESTADOS CUPONES ---
  const [cuponesDB, setCuponesDB] = useState<Cupon[]>([]);
  const [mostrarModalCrearCupon, setMostrarModalCrearCupon] = useState(false);
  const [mostrarModalValidarCupon, setMostrarModalValidarCupon] = useState(false);
  const [codigoCuponInput, setCodigoCuponInput] = useState('');
  const [cuponAplicado, setCuponAplicado] = useState<Cupon | null>(null);
  const [nuevoCupon, setNuevoCupon] = useState<Partial<Cupon>>({
    codigo: '', tipo: 'porcentaje', valor: 0, limite_usos: 0, compra_minima: 0, activo: true
  });

  // --- CÁLCULOS MATEMÁTICOS DEL CARRITO ---
  const subtotalCarrito = carrito.reduce((sum, item) => sum + item.subtotal, 0);
  
  let descuentoCuponValor = 0;
  if (cuponAplicado) {
    if (cuponAplicado.tipo === 'porcentaje') descuentoCuponValor = subtotalCarrito * (cuponAplicado.valor / 100);
    else descuentoCuponValor = cuponAplicado.valor;
  }
  
  const totalVenta = Math.max(0, subtotalCarrito - descuentoCuponValor);
  const cobroActual = esAnticipo ? (Number(montoAnticipo) || 0) : totalVenta;
  const cambio = typeof efectivoRecibido === 'number' && efectivoRecibido >= cobroActual ? efectivoRecibido - cobroActual : 0;

  const inicializarCaja = useCallback(async () => {
    setCargando(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single();
      if (perfil) setRolUsuario(perfil.rol.toLowerCase());
    }

    const { data: turno } = await supabase.from('turnos_caja').select('*').eq('estado', 'abierta').order('fecha_apertura', { ascending: false }).limit(1).single();
    if (turno) setTurnoActivo(turno);

    const { data: servicios } = await supabase.from('servicios').select('*') as any;
    const { data: materiales } = await supabase.from('materiales').select('*') as any;
    
    const catalogoUnificado: ProductoPOS[] = [];
    if (servicios) servicios.forEach((s: any) => catalogoUnificado.push({ id: s.id, nombre: s.nombre || s.titulo || s.servicio || 'Servicio sin nombre', precio: Number(s.precio || s.costo || s.precio_unitario || 0), tipo: 'servicio', procesos: s.procesos || [] }));
    if (materiales) materiales.forEach((m: any) => catalogoUnificado.push({ id: m.id, nombre: m.nombre || m.titulo || m.material || 'Material sin nombre', precio: Number(m.precio_base || m.precio || m.costo || m.precio_unitario || 0), tipo: 'material', tiene_ancho_fijo: m.tiene_ancho_fijo || false, ancho_fijo_valor: Number(m.ancho_fijo_valor || 0), procesos: m.procesos || [] }));
    setCatalogo(catalogoUnificado);

    const { data: clis } = await supabase.from('clientes').select('id, empresa').order('empresa');
    if (clis) setClientes(clis);

    const { data: cupones } = await supabase.from('cupones').select('*').order('created_at', { ascending: false });
    if (cupones) setCuponesDB(cupones as Cupon[]);

    setCargando(false);
  }, []);

  useEffect(() => { 
    const iniciar = async () => { await inicializarCaja(); };
    iniciar();
  }, [inicializarCaja]);

  const traerCotizacionesParaCobro = async () => {
    const { data } = await supabase.from('cotizaciones').select('id, folio, total, abonado, estado, clientes(empresa)').in('estado', ['Autorizada', 'Proyecto']).order('folio', { ascending: false });
    if (data) {
      const pendientes = data.filter((c: any) => (c.abonado || 0) < c.total);
      setCotizacionesPendientes(pendientes as unknown as CotizacionPendiente[]);
    }
  };

  const cargarVentasDia = async () => {
    if (!turnoActivo) return;
    const { data } = await supabase.from('ventas_mostrador')
      .select('id, total, metodo_pago, created_at, detalle_ventas(nombre_producto, cantidad, subtotal)')
      .eq('turno_id', turnoActivo.id)
      .order('created_at', { ascending: false });
    
    if (data) setVentasDia(data);
    setMostrarModalVentasDia(true);
  };

  const abrirCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('turnos_caja').insert([{ usuario_id: user?.id, monto_apertura: Number(montoApertura) || 0, estado: 'abierta' }]).select().single();
    if (!error && data) { setTurnoActivo(data); alert("✅ Caja abierta exitosamente."); }
  };

  const cerrarCaja = async () => {
    if (!turnoActivo) return;
    const { data: ventas } = await supabase.from('ventas_mostrador').select('total, metodo_pago').eq('turno_id', turnoActivo.id);
    let totalEfectivoVentas = 0;
    ventas?.forEach((v: any) => { if (v.metodo_pago === 'Efectivo') totalEfectivoVentas += Number(v.total); });
    
    const { data: egresos } = await supabase.from('egresos_caja').select('monto').eq('turno_id', turnoActivo.id);
    let totalEgresos = 0;
    egresos?.forEach((e: any) => { totalEgresos += Number(e.monto); });

    const totalEsperado = Number(turnoActivo.monto_apertura) + totalEfectivoVentas - totalEgresos;

    if (window.confirm(`💰 CORTE DE CAJA\n\nMonto Inicial: $${turnoActivo.monto_apertura}\nIngresos Efectivo: $${totalEfectivoVentas}\nRetiros: -$${totalEgresos}\n\nEFECTIVO ESPERADO EN CAJÓN: $${totalEsperado.toLocaleString()}\n\n¿Seguro que deseas cerrar el turno?`)) {
      await supabase.from('turnos_caja').update({ estado: 'cerrada', monto_cierre: totalEsperado, fecha_cierre: new Date().toISOString() }).eq('id', turnoActivo.id);
      setTurnoActivo(null); setMontoApertura('');
    }
  };

  const registrarEgreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoActivo || !egresoConcepto || !egresoMonto) return;
    const { error } = await supabase.from('egresos_caja').insert([{ turno_id: turnoActivo.id, concepto: egresoConcepto, monto: Number(egresoMonto) }]);
    if (!error) { alert("✅ Retiro registrado correctamente."); setMostrarModalEgreso(false); setEgresoConcepto(''); setEgresoMonto(''); } 
  };

  const imprimirTicket = (ventaId: string, items: ItemCarrito[], totalPedido: number, metodo: string, cuponObj?: Cupon | null, descuentoMonto: number = 0, esAnticipoOAbono: boolean = false, restante: number = 0, pagoActual: number = totalPedido) => {
    const ventana = window.open('', '_blank');
    if (!ventana) return;

    let clienteNombre = 'Venta de Mostrador';
    if (clienteSeleccionado) clienteNombre = clienteSeleccionado.empresa;
    else if (nombreMostrador) clienteNombre = `${nombreMostrador} (Mostrador)`;

    ventana.document.write(`
      <html>
      <head>
        <title>Ticket Heraco</title>
        <style>
          @page { margin: 0; size: 58mm auto; }
          body { font-family: 'Courier New', Courier, monospace; width: 48mm; margin: 0 auto; padding: 2mm 0; font-size: 11px; color: black; line-height: 1.2; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed black; margin: 5px 0; }
          .header h1 { margin: 0 0 2px 0; font-size: 18px; }
          .header p { margin: 2px 0; font-size: 9px; }
          .item-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .item-name { width: 65%; text-transform: uppercase; font-size: 10px; }
          .item-price { width: 35%; text-align: right; font-size: 10px; }
          .detalles { font-size: 8px; color: #444; margin-bottom: 4px; margin-left: 5px; }
          .totals-row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; }
          .grand-total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin: 5px 0; }
          .footer p { margin: 2px 0; font-size: 9px; }
          ::-webkit-scrollbar { display: none; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="header center">
          <h1>HERACO</h1>
          <p>Pache 360 - Agencia Creativa</p>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Ticket: #${ventaId.substring(0,8).toUpperCase()}</p>
          <p class="bold">Cliente: ${clienteNombre}</p>
        </div>
        
        <div class="divider"></div>
        
        <div class="items">
          ${items.map(i => `
            <div class="item-row">
              <div class="item-name">${i.cantidad}x ${i.nombre}</div>
              <div class="item-price">$${i.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            </div>
            ${i.detallesExtra ? `<div class="detalles">${i.detallesExtra}</div>` : ''}
          `).join('')}
        </div>

        <div class="divider"></div>

        <div class="totals">
          <div class="totals-row"><span>SUB PEDIDO:</span><span>$${(totalPedido + descuentoMonto).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
          ${cuponObj ? `<div class="totals-row" style="color:red;"><span>DESC (${cuponObj.codigo}):</span><span>-$${descuentoMonto.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>` : ''}
          <div class="grand-total"><span>TOTAL:</span><span>$${totalPedido.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
          
          <div class="divider"></div>
          
          <div class="totals-row"><span>MÉTODO:</span><span class="bold">${metodo.toUpperCase()}</span></div>
          <div class="totals-row bold"><span>SU PAGO AHORA:</span><span>$${pagoActual.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
          
          ${metodo === 'Efectivo' && typeof efectivoRecibido === 'number' && efectivoRecibido > 0 ? `
            <div class="totals-row"><span>EFECTIVO:</span><span>$${Number(efectivoRecibido).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            <div class="totals-row"><span>CAMBIO:</span><span>$${cambio.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
          ` : ''}

          ${esAnticipoOAbono ? `
            <div class="divider"></div>
            <div class="totals-row bold" style="font-size: 12px;"><span>RESTA POR PAGAR:</span><span>$${restante.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
          ` : ''}
        </div>

        <div class="divider"></div>
        
        <div class="footer center">
          <p class="bold">¡Gracias por su compra!</p>
          <p>heracosoft.mx</p>
        </div>

        <script>
          window.onload = function() { 
            setTimeout(() => {
              window.print(); 
            }, 500);
          };
          window.onafterprint = function() {
            window.close();
          }
        </script>
      </body>
      </html>
    `);
    ventana.document.close();
  };

  const registrarAbonoCotizacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoActivo || !cotizacionPagar || !montoAbono) return;
    
    const abono = Number(montoAbono);
    const nuevoAbonado = (cotizacionPagar.abonado || 0) + abono;
    const liquidada = nuevoAbonado >= cotizacionPagar.total;
    const nuevoEstado = liquidada ? 'Archivada' : cotizacionPagar.estado; 
    const restante = cotizacionPagar.total - nuevoAbonado;

    const { data: venta } = await supabase.from('ventas_mostrador').insert([{ turno_id: turnoActivo.id, total: abono, metodo_pago: metodoPago }]).select().single();
    if (!venta) return alert("Error al registrar el abono.");

    await supabase.from('detalle_ventas').insert([{ venta_id: venta.id, nombre_producto: `Abono/Liquidación Encargo #${cotizacionPagar.folio}`, cantidad: 1, precio_unitario: abono, subtotal: abono }]);
    await supabase.from('cotizaciones').update({ abonado: nuevoAbonado, estado: nuevoEstado }).eq('id', cotizacionPagar.id);

    const itemImpresion: ItemCarrito = {
      id: 'abono', idUnico: '1', cantidad: 1, precio: abono, subtotal: abono, tipo: 'servicio',
      nombre: `Abono a Encargo #${cotizacionPagar.folio}`, detallesExtra: liquidada ? 'Liquidación Total' : 'Anticipo Parcial'
    };
    
    imprimirTicket(venta.id, [itemImpresion], abono, metodoPago, null, 0, true, restante, abono);

    alert(`✅ Abono registrado. ${liquidada ? '¡Cotización/Encargo archivado!' : ''}`);
    setCotizacionPagar(null); setMontoAbono(''); setMetodoPago('Efectivo'); setEfectivoRecibido('');
    traerCotizacionesParaCobro();
  };

  const procesarVenta = async () => {
    if (!turnoActivo) return alert("Debes abrir la caja.");
    if (carrito.length === 0) return alert("Carrito vacío.");

    const checklistGenerado: any[] = [];
    const agrupados = new Set();
    carrito.forEach(item => {
      if (item.procesos && item.procesos.length > 0) {
        if (!agrupados.has(item.nombre)) {
          agrupados.add(item.nombre);
          checklistGenerado.push({ producto: item.nombre, procesos: item.procesos.map((proc: string) => ({ nombre: proc, completado: false })) });
        }
      }
    });

    if (esAnticipo) {
        const pagoInicial = Number(montoAnticipo) || 0;
        if (pagoInicial <= 0 || pagoInicial > totalVenta) return alert("Monto de anticipo inválido.");
        if (metodoPago === 'Efectivo' && (efectivoRecibido === '' || efectivoRecibido < pagoInicial)) return alert("El efectivo no cubre el anticipo.");

        let clienteId = clienteSeleccionado?.id;
        let nombreCli = clienteSeleccionado?.empresa;

        if (!clienteId) {
            if (!nombreMostrador) return alert("Debes ingresar un Nombre Temporal para poder guardar el encargo.");
            
            const { data: nCli, error: errCli } = await supabase.from('clientes').insert([{ 
                empresa: `${nombreMostrador} (Mostrador)`,
                nombre_contacto: nombreMostrador,
                telefono: telefonoMostrador
            }]).select().single();
            
            if (errCli || !nCli) {
                console.error("Detalle del error:", errCli);
                return alert(`Error al guardar: ${errCli?.message}`);
            }
            
            clienteId = nCli.id;
            nombreCli = nCli.empresa;
        }

        const sub = totalVenta / 1.16;
        const iva = totalVenta - sub;
        const { data: cot } = await supabase.from('cotizaciones').insert([{
            cliente_id: clienteId, subtotal: sub, iva: iva, total: totalVenta, estado: 'Autorizada', abonado: pagoInicial
        }]).select().single();

        const { data: venta } = await supabase.from('ventas_mostrador').insert([{ turno_id: turnoActivo.id, total: pagoInicial, metodo_pago: metodoPago }]).select().single();
        
        await supabase.from('proyectos').insert([{
            cliente: nombreCli, nombre: `Encargo #${cot.folio || 'S/N'}`, total: totalVenta, estado: 'Pendiente', checklist_procesos: checklistGenerado, cotizacion_id: cot.id, venta_id: venta.id
        }]);

        await supabase.from('detalle_ventas').insert([{ venta_id: venta.id, nombre_producto: `Anticipo Encargo #${cot.folio || 'S/N'}`, cantidad: 1, precio_unitario: pagoInicial, subtotal: pagoInicial }]);

        if (cuponAplicado) await supabase.from('cupones').update({ usos_actuales: cuponAplicado.usos_actuales + 1 }).eq('id', cuponAplicado.id);

        imprimirTicket(venta.id, carrito, totalVenta, metodoPago, cuponAplicado, descuentoCuponValor, true, totalVenta - pagoInicial, pagoInicial);

    } else {
        if (metodoPago === 'Efectivo' && (efectivoRecibido === '' || efectivoRecibido < totalVenta)) return alert("El efectivo no cubre el total.");

        const { data: venta } = await supabase.from('ventas_mostrador').insert([{ turno_id: turnoActivo.id, total: totalVenta, metodo_pago: metodoPago }]).select().single();
        if (!venta) return alert("Error al registrar venta.");

        const detalles = carrito.map(item => ({
          venta_id: venta.id, nombre_producto: item.detallesExtra ? `${item.nombre} [${item.detallesExtra}]` : item.nombre,
          cantidad: item.cantidad, precio_unitario: item.precio, subtotal: item.subtotal
        }));
        await supabase.from('detalle_ventas').insert(detalles);

        const nombreClienteProyecto = clienteSeleccionado ? clienteSeleccionado.empresa : (nombreMostrador ? `${nombreMostrador} (Mostrador)` : `Mostrador (Ticket #${venta.id.substring(0,8).toUpperCase()})`);
        
        await supabase.from('proyectos').insert([{ cliente: nombreClienteProyecto, nombre: `Venta Directa #${venta.id.substring(0,8).toUpperCase()}`, total: totalVenta, estado: 'Pendiente', checklist_procesos: checklistGenerado, venta_id: venta.id }]);

        if (cuponAplicado) await supabase.from('cupones').update({ usos_actuales: cuponAplicado.usos_actuales + 1 }).eq('id', cuponAplicado.id);

        imprimirTicket(venta.id, carrito, totalVenta, metodoPago, cuponAplicado, descuentoCuponValor, false, 0, totalVenta);
    }

    setCarrito([]); setEfectivoRecibido(''); setBusqueda(''); setClienteSeleccionado(null); setCuponAplicado(null);
    setEsAnticipo(false); setMontoAnticipo(''); setNombreMostrador(''); setTelefonoMostrador('');
  };

  const crearCupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('cupones').insert([{ ...nuevoCupon, codigo: nuevoCupon.codigo?.toUpperCase().trim() }]);
    if (error) return alert("Error al crear cupón.");
    alert("✅ Cupón Creado.");
    setMostrarModalCrearCupon(false);
    setNuevoCupon({ codigo: '', tipo: 'porcentaje', valor: 0, limite_usos: 0, compra_minima: 0, activo: true });
    const { data: cupones } = await supabase.from('cupones').select('*').order('created_at', { ascending: false });
    if (cupones) setCuponesDB(cupones as Cupon[]);
  };

  const aplicarCuponVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = codigoCuponInput.toUpperCase().trim();
    const { data: cupon } = await supabase.from('cupones').select('*').eq('codigo', codigo).single();
    if (!cupon) return alert("❌ El cupón no existe.");
    if (!cupon.activo) return alert("❌ El cupón está inactivo.");
    if (cupon.limite_usos && cupon.usos_actuales >= cupon.limite_usos) return alert("❌ El cupón alcanzó su límite de usos.");
    if (cupon.fecha_expiracion && new Date(cupon.fecha_expiracion) < new Date()) return alert("❌ El cupón ya expiró.");
    if (cupon.compra_minima > subtotalCarrito) return alert(`❌ Requiere una compra mínima de $${cupon.compra_minima.toLocaleString()}`);

    setCuponAplicado(cupon);
    setMostrarModalValidarCupon(false);
    setCodigoCuponInput('');
  };

  const iniciarOverride = (idUnico: string) => {
    setItemAEditar(idUnico); setNuevoPrecioOverride(''); setPinAdminOverride('');
    setMostrarModalOverride(true);
  };

  const aplicarPrecioOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemAEditar || nuevoPrecioOverride === '') return;
    if (!esAdmin && pinAdminOverride !== '1234') return alert("❌ PIN de Administrador Incorrecto.");

    setCarrito(prev => prev.map(item => {
      if (item.idUnico === itemAEditar) return { ...item, precio: Number(nuevoPrecioOverride), subtotal: item.cantidad * Number(nuevoPrecioOverride) };
      return item;
    }));
    setMostrarModalOverride(false);
  };

  const agregarAlCarrito = (prod: ProductoPOS) => {
    if (prod.tipo === 'material') { setProductoMedidas(prod); setAncho(''); setAlto(''); return; }
    setCarrito(prev => {
      const existe = prev.find(item => item.id === prod.id && !item.detallesExtra);
      if (existe) return prev.map(item => item.idUnico === existe.idUnico ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio } : item);
      return [...prev, { ...prod, idUnico: `${prod.id}-${Date.now()}`, cantidad: 1, subtotal: prod.precio }];
    });
    setBusqueda(''); 
  };
  
  const calcularPrecioMaterial = (): number => {
    if (!productoMedidas || typeof ancho !== 'number' || typeof alto !== 'number' || ancho <= 0 || alto <= 0) return 0;
    if (productoMedidas.tiene_ancho_fijo && productoMedidas.ancho_fijo_valor && productoMedidas.ancho_fijo_valor > 0) {
      const r = productoMedidas.ancho_fijo_valor;
      return Math.min((Math.ceil(ancho / r) * r) * alto, (Math.ceil(alto / r) * r) * ancho) * productoMedidas.precio;
    }
    return (ancho * alto) * productoMedidas.precio;
  };

  const confirmarMedidas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoMedidas || !ancho || !alto) return;
    const c = calcularPrecioMaterial();
    setCarrito(prev => [...prev, { ...productoMedidas, idUnico: `${productoMedidas.id}-${Date.now()}`, cantidad: 1, precio: c, subtotal: c, detallesExtra: `${ancho}m x ${alto}m ${productoMedidas.tiene_ancho_fijo ? `(Empalmes)` : ''}` }]);
    setProductoMedidas(null); setBusqueda('');
  };

  const cambiarCantidad = (idUnico: string, delta: number) => {
    setCarrito(prev => prev.map(item => {
      if (item.idUnico === idUnico) {
        const nc = item.cantidad + delta;
        if (nc < 1) return item;
        return { ...item, cantidad: nc, subtotal: nc * item.precio };
      }
      return item;
    }));
  };

  const eliminarDelCarrito = (idUnico: string) => {
    setCarrito(prev => prev.filter(item => item.idUnico !== idUnico));
  };

  const productosFiltrados = catalogo.filter(p => p.nombre && p.nombre.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 10); 
  const clientesFiltrados = clientes.filter(c => c.empresa.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 8);
  const ordenesFiltradas = cotizacionesPendientes.filter(c => 
     c.folio.toString().includes(busquedaOrdenes) || 
     (c.clientes?.empresa.toLowerCase().includes(busquedaOrdenes.toLowerCase()))
  );

  if (cargando) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-heraco border-t-transparent"></div></div>;

  if (!turnoActivo) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 md:p-10 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-heraco/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-heraco/20"><Lock size={40} className="text-heraco" /></div>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic text-white mb-2">Caja Cerrada</h1>
          <p className="text-sm text-zinc-500 font-bold mb-8">Debes iniciar un turno para poder cobrar.</p>
          <form onSubmit={abrirCaja}>
            <div className="text-left mb-6">
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">Efectivo inicial en cajón</label>
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-black">$</span><input type="number" required min="0" step="0.01" className="w-full bg-black border border-zinc-800 rounded-2xl p-4 pl-8 text-white focus:border-heraco outline-none font-bold text-lg" value={montoApertura} onChange={e => setMontoApertura(Number(e.target.value))} /></div>
            </div>
            <button type="submit" className="w-full bg-heraco text-black font-black py-4 rounded-2xl uppercase text-sm tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2"><Unlock size={18} /> ABRIR CAJA</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    // 🟢 EL TRUCO ESTÁ AQUÍ: Le quitamos la altura fija (h-screen) en móvil para que pueda crecer hacia abajo con scroll natural
    <div className="min-h-screen md:h-screen bg-black flex flex-col md:flex-row overflow-y-auto md:overflow-hidden text-white font-sans relative">
      
      {/* LADO IZQUIERDO (PRODUCTOS Y CATÁLOGO) */}
      <div className="w-full md:w-3/5 lg:w-2/3 flex flex-col border-b md:border-b-0 md:border-r border-zinc-800 p-4 md:p-6 bg-black md:overflow-hidden min-h-[60vh] md:min-h-0">
        
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 md:mb-6 gap-3">
          <div>
            {/* Texto autoajustable */}
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase italic text-white flex items-center gap-2 md:gap-3"><ShoppingCart className="text-heraco" /> Punto de Venta</h1>
            <p className="text-heraco font-bold text-[10px] md:text-xs tracking-widest uppercase mt-1">Turno Activo • Abierto a las {new Date(turnoActivo.fecha_apertura).toLocaleTimeString()}</p>
          </div>
          {/* Botonera envolvente */}
          <div className="flex flex-wrap gap-2">
            <button onClick={cargarVentasDia} className="bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-2 md:px-4 md:py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"><ListOrdered size={14}/> Ventas del Día</button>
            {esAdmin && <button onClick={() => setMostrarModalCrearCupon(true)} className="bg-heraco/10 border border-heraco/20 text-heraco hover:bg-heraco hover:text-black px-3 py-2 md:px-4 md:py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"><Ticket size={14}/> Admin Cupones</button>}
            <button onClick={() => { traerCotizacionesParaCobro(); setMostrarModalCotizaciones(true); }} className="bg-heraco/10 border border-heraco/20 text-heraco hover:bg-heraco hover:text-black px-3 py-2 md:px-4 md:py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"><FileText size={14}/> Órdenes / Cobrar</button>
            <button onClick={() => setMostrarModalEgreso(true)} className="bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-orange-500 px-3 py-2 md:px-4 md:py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"><ArrowDownCircle size={14}/> Retiro Efectivo</button>
            <button onClick={cerrarCaja} className="bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white px-3 py-2 md:px-4 md:py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"><Lock size={14}/> Cerrar Turno</button>
          </div>
        </div>

        <div className="relative mb-4 md:mb-6 shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-heraco" size={24} />
          <input type="text" placeholder="Buscar producto o impresión..." className="w-full bg-zinc-900/50 border border-zinc-800 rounded-3xl py-4 md:py-6 pl-12 md:pl-14 pr-4 md:pr-6 text-lg md:text-xl font-bold text-white focus:border-heraco outline-none transition-all placeholder:text-zinc-600 shadow-inner" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {busqueda.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 pb-4">
              {productosFiltrados.map(prod => (
                <div key={prod.id} onClick={() => agregarAlCarrito(prod)} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl cursor-pointer hover:border-heraco/50 hover:bg-zinc-800 transition-all group flex flex-col justify-between h-32 active:scale-95">
                  <div>
                    <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${prod.tipo === 'servicio' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>{prod.tipo}</span>
                    <h3 className="font-bold text-xs md:text-sm mt-2 leading-tight line-clamp-2">{prod.nombre}</h3>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <p className="text-sm md:text-lg font-black text-heraco">${prod.precio.toLocaleString()}<span className="text-[9px] md:text-[10px] text-zinc-500">{prod.tipo === 'material' ? ' /m²' : ''}</span></p>
                    <div className="w-8 h-8 rounded-full bg-black border border-zinc-700 flex items-center justify-center group-hover:bg-heraco group-hover:text-black transition-colors"><Plus size={16} /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-50 py-10"><Search size={48} className="mb-4" /><p className="font-bold text-xs md:text-sm uppercase tracking-widest">Escribe para buscar</p></div>
          )}
        </div>
      </div>

      {/* LADO DERECHO (TICKET Y COBRO) */}
      <div className="w-full md:w-2/5 lg:w-1/3 flex flex-col bg-zinc-950 p-4 md:p-6 shadow-2xl relative z-10 md:border-l border-zinc-900 md:overflow-hidden min-h-[70vh] md:min-h-0">
        
        {/* SELECTOR CLIENTE */}
        <div className="mb-4 shrink-0">
          <button onClick={() => { setBusqueda(''); setMostrarModalClientes(true); }} className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between group ${clienteSeleccionado ? 'bg-heraco/10 border-heraco/50 text-heraco' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'}`}>
            <div className="flex items-center gap-2"><Users size={16} /><div className="text-left"><p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-500">Asignar a Cliente</p><p className="text-xs md:text-sm font-bold uppercase truncate w-40">{clienteSeleccionado ? clienteSeleccionado.empresa : 'Venta de Mostrador'}</p></div></div>
            {clienteSeleccionado && <div onClick={(e) => { e.stopPropagation(); setClienteSeleccionado(null); }} className="p-2 hover:bg-black rounded-full text-zinc-500 hover:text-red-500"><X size={14}/></div>}
          </button>
          
          {!clienteSeleccionado && (
            <div className="flex gap-2 mt-2">
              <input type="text" placeholder="Nombre (Para Encargos)" className="flex-1 bg-black border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-heraco outline-none font-bold" value={nombreMostrador} onChange={e => setNombreMostrador(e.target.value)} />
              <input type="text" placeholder="Teléfono" className="w-1/3 bg-black border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-heraco outline-none font-bold" value={telefonoMostrador} onChange={e => setTelefonoMostrador(e.target.value)} />
            </div>
          )}
        </div>

        <h2 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 md:mb-4 border-b border-zinc-800 pb-2 flex justify-between shrink-0">Ticket Actual
          {carrito.length > 0 && <button onClick={() => setMostrarModalValidarCupon(true)} className="text-[10px] text-heraco hover:text-white flex items-center gap-1"><Percent size={12}/> Usar Cupón</button>}
        </h2>
        
        {/* LISTA DE ITEMS DEL TICKET */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-4">
          {carrito.length === 0 ? (
            <p className="text-zinc-600 text-xs text-center mt-10 font-bold italic">No hay productos en la cuenta.</p>
          ) : (
            carrito.map(item => (
              <div key={item.idUnico} className="bg-black border border-zinc-800 p-3 md:p-4 rounded-2xl group/item">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-xs md:text-sm leading-tight pr-4 text-white">{item.nombre}</h4>
                  <button onClick={() => eliminarDelCarrito(item.idUnico)} className="text-zinc-600 hover:text-red-500 shrink-0"><Trash2 size={16}/></button>
                </div>
                {item.detallesExtra && <p className="text-[10px] text-heraco/80 mb-2 font-bold italic">{item.detallesExtra}</p>}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 md:gap-3 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                    <button onClick={() => cambiarCantidad(item.idUnico, -1)} className="p-1 hover:bg-zinc-800 rounded"><Minus size={14}/></button>
                    <span className="font-black text-xs w-4 text-center">{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(item.idUnico, 1)} className="p-1 hover:bg-zinc-800 rounded text-heraco"><Plus size={14}/></button>
                  </div>
                  <div className="flex flex-col items-end">
                     <span onClick={() => iniciarOverride(item.idUnico)} className="font-black text-sm md:text-base text-white cursor-pointer hover:text-heraco transition-colors" title="Modificar Precio">
                        ${item.subtotal.toLocaleString()}
                     </span>
                     {!esAdmin && <span className="text-[8px] text-zinc-600 uppercase opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center gap-1"><Lock size={8}/> Modificar</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ZONA DE COBRO */}
        <div className="bg-black border border-zinc-800 rounded-3xl md:rounded-4xl p-4 md:p-6 shrink-0 mt-auto shadow-xl">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button onClick={() => setMetodoPago('Efectivo')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${metodoPago === 'Efectivo' ? 'bg-heraco/10 border-heraco text-heraco' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}><Banknote size={20}/> <span className="text-[9px] md:text-[10px] font-black uppercase">Efectivo</span></button>
            <button onClick={() => setMetodoPago('Tarjeta')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${metodoPago === 'Tarjeta' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}><CreditCard size={20}/> <span className="text-[9px] md:text-[10px] font-black uppercase">Tarjeta</span></button>
            <button onClick={() => setMetodoPago('Transferencia')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${metodoPago === 'Transferencia' ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}><Smartphone size={20}/> <span className="text-[9px] md:text-[10px] font-black uppercase">Transf</span></button>
          </div>
          
          {cuponAplicado && (
            <div className="flex justify-between items-center text-[10px] md:text-xs font-black uppercase text-red-400 border-b border-zinc-800 pb-2 mb-2">
               <span>Descuento ({cuponAplicado.codigo}):</span>
               <span>-${(descuentoCuponValor).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4 pt-2 border-t border-zinc-800">
            <input type="checkbox" checked={esAnticipo} onChange={e => setEsAnticipo(e.target.checked)} className="accent-heraco w-4 h-4 cursor-pointer" />
            <label className="text-[10px] md:text-xs uppercase font-black text-zinc-300 cursor-pointer" onClick={() => setEsAnticipo(!esAnticipo)}>Es Encargo (Dejar Anticipo)</label>
          </div>

          {esAnticipo && (
            <div className="mb-4">
              <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase mb-1 block">Monto del Anticipo:</label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-heraco font-bold">$</span><input type="number" step="0.01" max={Number(totalVenta.toFixed(2))} className="w-full bg-zinc-900 border border-heraco/50 rounded-xl py-3 pl-7 pr-3 text-white focus:border-heraco outline-none font-black text-lg" value={montoAnticipo} onChange={e => setMontoAnticipo(e.target.value === '' ? '' : Number(e.target.value))} /></div>
            </div>
          )}

          {metodoPago === 'Efectivo' && (
            <div className="flex gap-3 md:gap-4 mb-4 border-b border-zinc-800 pb-4">
              <div className="flex-1"><label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase mb-1 block">Recibe (Efec):</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">$</span><input type="number" min={cobroActual} step="0.01" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-7 pr-3 text-white focus:border-heraco outline-none font-bold text-sm md:text-base" value={efectivoRecibido} onChange={e => setEfectivoRecibido(e.target.value === '' ? '' : Number(e.target.value))} /></div></div>
              <div className="flex-1 text-right"><label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase mb-1 block">Cambio:</label><p className={`font-black text-lg md:text-xl ${cambio >= 0 ? 'text-heraco' : 'text-red-500'}`}>${cambio >= 0 ? cambio.toLocaleString(undefined, {minimumFractionDigits: 2}) : '0.00'}</p></div>
            </div>
          )}
          
          <div className="flex justify-between items-end mb-6">
            <span className="text-sm md:text-base font-black uppercase text-zinc-400">Total Pedido</span>
            <span className="text-3xl md:text-4xl font-black italic tracking-tighter text-white">${totalVenta.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          
          <button onClick={procesarVenta} disabled={carrito.length === 0} className={`w-full font-black py-4 md:py-5 rounded-2xl uppercase tracking-widest flex justify-center items-center gap-3 transition-all text-xs md:text-sm ${carrito.length > 0 ? 'bg-heraco text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(203,222,32,0.2)]' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
            <Printer size={20} /> {esAnticipo ? 'Guardar Encargo e Imprimir' : 'Cobrar e Imprimir'}
          </button>
        </div>
      </div>

      {/* --- MODALES --- */}
      {mostrarModalVentasDia && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setMostrarModalVentasDia(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <h2 className="text-2xl font-black uppercase italic text-blue-400 mb-2 flex items-center gap-2"><ListOrdered/> Ventas del Turno</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6">Total acumulado: <span className="text-white">${ventasDia.reduce((acc: any, v: any) => acc + Number(v.total), 0).toLocaleString()}</span></p>
            
            <div className="space-y-4">
              {ventasDia.length === 0 ? (
                <p className="text-center text-zinc-600 py-10 font-bold uppercase tracking-widest text-xs">No hay ventas registradas aún.</p>
              ) : (
                ventasDia.map(v => (
                  <div key={v.id} className="bg-black border border-zinc-800 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Folio #{v.id.substring(0,8).toUpperCase()} • {new Date(v.created_at).toLocaleTimeString()}</p>
                      <div className="text-xs font-bold text-zinc-300">
                        {v.detalle_ventas?.map((d: any, i: number) => (
                          <div key={i}>• {d.cantidad}x {d.nombre_producto}</div>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black uppercase text-zinc-400 mb-1">{v.metodo_pago}</p>
                      <p className="text-2xl font-black italic text-heraco">${v.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {mostrarModalCotizaciones && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setMostrarModalCotizaciones(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            
            {!cotizacionPagar ? (
              <>
                <h2 className="text-xl md:text-2xl font-black uppercase italic text-heraco mb-4 flex items-center gap-2"><FileText /> Órdenes y Encargos Pendientes</h2>
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-heraco" size={16} />
                  <input type="text" placeholder="Buscar por Folio o Nombre..." className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-10 pr-3 text-white focus:border-heraco outline-none font-bold text-sm" value={busquedaOrdenes} onChange={e => setBusquedaOrdenes(e.target.value)} />
                </div>

                {ordenesFiltradas.length === 0 ? (
                  <p className="text-zinc-500 text-center py-10 font-bold uppercase tracking-widest text-xs">No hay encargos pendientes con esa búsqueda.</p>
                ) : (
                  <div className="space-y-3">
                    {ordenesFiltradas.map(c => {
                      const restante = c.total - (c.abonado || 0);
                      return (
                        <div key={c.id} className="bg-black border border-zinc-800 p-4 md:p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group hover:border-heraco transition-all">
                          <div>
                            <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Folio #{c.folio} • {c.clientes?.empresa}</p>
                            <p className="font-bold text-white text-sm md:text-base">Total: <span className="text-heraco">${c.total.toLocaleString()}</span></p>
                            <p className="text-[10px] font-bold text-zinc-400">Abonado previamente: ${(c.abonado || 0).toLocaleString()}</p>
                          </div>
                          <div className="w-full md:w-auto text-left md:text-right border-t border-zinc-800 md:border-0 pt-3 md:pt-0">
                            <p className="text-xs md:text-sm font-black uppercase text-red-400 mb-2">Resta: ${restante.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                            <button onClick={() => setCotizacionPagar(c)} className="w-full md:w-auto bg-zinc-800 text-white hover:bg-heraco hover:text-black px-4 py-3 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Aplicar Pago</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="animate-in slide-in-from-right duration-300">
                <button onClick={() => {setCotizacionPagar(null); setMontoAbono('');}} className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6 hover:text-white flex items-center gap-1">← Volver a la lista</button>
                <h2 className="text-xl md:text-2xl font-black uppercase italic text-white mb-2">Aplicar Pago</h2>
                <p className="text-xs md:text-sm font-bold text-zinc-400 mb-6">Orden/Encargo #{cotizacionPagar.folio} • {cotizacionPagar.clientes?.empresa}</p>

                <div className="bg-zinc-900 border border-zinc-800 p-4 md:p-6 rounded-2xl mb-6 grid grid-cols-2 gap-4">
                  <div><p className="text-[9px] uppercase font-black text-zinc-500">Restante por pagar</p><p className="text-2xl md:text-3xl font-black text-red-400">${(cotizacionPagar.total - (cotizacionPagar.abonado || 0)).toLocaleString()}</p></div>
                  <div className="text-right"><p className="text-[9px] uppercase font-black text-zinc-500">Abonado</p><p className="text-lg md:text-xl font-bold text-zinc-300">${(cotizacionPagar.abonado || 0).toLocaleString()}</p></div>
                </div>

                <form onSubmit={registrarAbonoCotizacion}>
                  <div className="mb-6">
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 block tracking-widest">Monto a abonar ahora</label>
                        <button type="button" onClick={() => {
                            const rest = Number((cotizacionPagar.total - (cotizacionPagar.abonado || 0)).toFixed(2));
                            setMontoAbono(rest);
                            setEfectivoRecibido(rest);
                        }} className="bg-heraco/20 text-heraco border border-heraco/30 px-3 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase hover:bg-heraco hover:text-black transition-colors">
                          Liquidar Restante
                        </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-heraco font-black text-xl">$</span>
                      <input type="number" step="0.01" max={Number((cotizacionPagar.total - (cotizacionPagar.abonado || 0)).toFixed(2))} required className="w-full bg-black border border-heraco/50 rounded-2xl p-5 pl-10 focus:border-heraco outline-none font-black text-2xl text-white" value={montoAbono} onChange={e => setMontoAbono(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-6">
                    <button type="button" onClick={() => setMetodoPago('Efectivo')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${metodoPago === 'Efectivo' ? 'bg-heraco/10 border-heraco text-heraco' : 'bg-black border-zinc-800 text-zinc-500'}`}><Banknote size={20}/> <span className="text-[9px] font-black uppercase">Efectivo</span></button>
                    <button type="button" onClick={() => setMetodoPago('Tarjeta')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${metodoPago === 'Tarjeta' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-black border-zinc-800 text-zinc-500'}`}><CreditCard size={20}/> <span className="text-[9px] font-black uppercase">Tarjeta</span></button>
                    <button type="button" onClick={() => setMetodoPago('Transferencia')} className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${metodoPago === 'Transferencia' ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-black border-zinc-800 text-zinc-500'}`}><Smartphone size={20}/> <span className="text-[9px] font-black uppercase">Transf</span></button>
                  </div>

                  {metodoPago === 'Efectivo' && (
                    <div className="flex gap-4 mb-6 border-t border-zinc-800 pt-4">
                      <div className="flex-1"><label className="text-[9px] font-black text-zinc-500 uppercase mb-1 block">Recibe (Efec):</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">$</span><input type="number" min={Number(montoAbono) || 0} step="0.01" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-7 pr-3 text-white focus:border-heraco outline-none font-bold text-sm" value={efectivoRecibido} onChange={e => setEfectivoRecibido(e.target.value === '' ? '' : Number(e.target.value))} /></div></div>
                      <div className="flex-1 text-right"><label className="text-[9px] font-black text-zinc-500 uppercase mb-1 block">Cambio:</label><p className={`font-black text-xl ${(typeof efectivoRecibido === 'number' && efectivoRecibido >= Number(montoAbono)) ? 'text-heraco' : 'text-red-500'}`}>${(typeof efectivoRecibido === 'number' && efectivoRecibido >= Number(montoAbono)) ? (efectivoRecibido - Number(montoAbono)).toLocaleString(undefined, {minimumFractionDigits: 2}) : '0.00'}</p></div>
                    </div>
                  )}

                  <button type="submit" className="w-full bg-heraco text-black font-black py-4 rounded-2xl uppercase text-sm tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(203,222,32,0.2)]"><CheckCircle size={20}/> Confirmar Pago</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {mostrarModalOverride && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-100 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative">
            <button onClick={() => setMostrarModalOverride(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto border border-red-500/20"><Key className="text-red-500" size={28}/></div>
            <h2 className="text-xl font-black uppercase italic text-center text-white mb-2">Autorización Requerida</h2>
            <p className="text-[10px] text-zinc-400 text-center uppercase tracking-widest mb-6 font-bold">Modificación de Precio</p>
            
            <form onSubmit={aplicarPrecioOverride} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">Nuevo Precio Unitario ($)</label>
                <input type="number" step="0.01" required className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white focus:border-heraco outline-none font-black text-xl text-center" value={nuevoPrecioOverride} onChange={e => setNuevoPrecioOverride(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>

              {!esAdmin && (
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">PIN de Administrador</label>
                  <input type="password" required className="w-full bg-black border border-red-500/30 rounded-xl p-4 text-white focus:border-red-500 outline-none font-black text-xl text-center tracking-[1em]" maxLength={4} value={pinAdminOverride} onChange={e => setPinAdminOverride(e.target.value)} />
                </div>
              )}

              <button type="submit" className="w-full bg-heraco text-black font-black py-4 rounded-xl uppercase text-sm tracking-widest hover:scale-[1.02] transition-all mt-4">Autorizar Cambio</button>
            </form>
          </div>
        </div>
      )}

      {mostrarModalValidarCupon && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-90 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-sm rounded-4xl p-6 md:p-8 shadow-2xl relative">
            <button onClick={() => setMostrarModalValidarCupon(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase italic text-heraco mb-6 flex items-center gap-2"><Percent/> Ingresar Cupón</h2>
            <form onSubmit={aplicarCuponVenta}>
              <input required placeholder="Ej. DESCUENTO10" className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white focus:border-heraco outline-none font-black text-center uppercase text-xl tracking-widest mb-4" value={codigoCuponInput} onChange={e => setCodigoCuponInput(e.target.value)} />
              <button type="submit" className="w-full bg-heraco text-black font-black py-4 rounded-xl uppercase text-[10px] tracking-widest hover:scale-105 transition-all">Validar y Aplicar</button>
            </form>
          </div>
        </div>
      )}

      {mostrarModalCrearCupon && esAdmin && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setMostrarModalCrearCupon(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <h2 className="text-xl md:text-2xl font-black uppercase italic text-heraco mb-6 flex items-center gap-2"><Ticket/> Administrar Cupones</h2>
            
            <form onSubmit={crearCupon} className="bg-black/50 border border-zinc-800 rounded-2xl p-4 md:p-6 mb-8 space-y-4">
              <h3 className="text-xs font-black uppercase text-zinc-400 border-b border-zinc-800 pb-2">Crear Nuevo Cupón</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-[9px] font-black text-zinc-500 uppercase ml-2 mb-1 block tracking-widest">Código</label><input required className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-heraco outline-none font-bold uppercase" value={nuevoCupon.codigo} onChange={e => setNuevoCupon({...nuevoCupon, codigo: e.target.value})} /></div>
                <div><label className="text-[9px] font-black text-zinc-500 uppercase ml-2 mb-1 block tracking-widest">Tipo</label><select className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-heraco outline-none font-bold" value={nuevoCupon.tipo} onChange={e => setNuevoCupon({...nuevoCupon, tipo: e.target.value as "porcentaje" | "fijo"})}><option value="porcentaje">Porcentaje (%)</option><option value="fijo">Monto Fijo ($)</option></select></div>
                <div><label className="text-[9px] font-black text-zinc-500 uppercase ml-2 mb-1 block tracking-widest">Valor</label><input type="number" required className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-heraco outline-none font-bold" value={nuevoCupon.valor} onChange={e => setNuevoCupon({...nuevoCupon, valor: Number(e.target.value)})} /></div>
                <div><label className="text-[9px] font-black text-zinc-500 uppercase ml-2 mb-1 block tracking-widest">Vigencia (Opcional)</label><input type="date" className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-zinc-400 focus:border-heraco outline-none font-bold" value={nuevoCupon.fecha_expiracion || ''} onChange={e => setNuevoCupon({...nuevoCupon, fecha_expiracion: e.target.value})} /></div>
                <div><label className="text-[9px] font-black text-zinc-500 uppercase ml-2 mb-1 block tracking-widest">Usos Máximos (0 = Infinito)</label><input type="number" className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-heraco outline-none font-bold" value={nuevoCupon.limite_usos} onChange={e => setNuevoCupon({...nuevoCupon, limite_usos: Number(e.target.value)})} /></div>
                <div><label className="text-[9px] font-black text-zinc-500 uppercase ml-2 mb-1 block tracking-widest">Compra Mínima ($)</label><input type="number" className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-heraco outline-none font-bold" value={nuevoCupon.compra_minima} onChange={e => setNuevoCupon({...nuevoCupon, compra_minima: Number(e.target.value)})} /></div>
              </div>
              <button type="submit" className="w-full bg-heraco text-black font-black py-3 rounded-xl uppercase text-[10px] tracking-widest mt-2 hover:scale-[1.02] transition-all">Generar Cupón</button>
            </form>

            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-zinc-400 border-b border-zinc-800 pb-2">Cupones Existentes</h3>
              {cuponesDB.map(c => (
                <div key={c.id} className="flex justify-between items-center bg-black border border-zinc-800 p-4 rounded-xl">
                  <div>
                    <span className="font-black text-heraco uppercase text-base md:text-lg">{c.codigo}</span>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Desc: {c.tipo === 'porcentaje' ? `${c.valor}%` : `$${c.valor}`} | Usos: {c.usos_actuales} {c.limite_usos ? `/ ${c.limite_usos}` : ' (Ilimitado)'}</p>
                  </div>
                  <button onClick={async () => { await supabase.from('cupones').delete().eq('id', c.id); const { data } = await supabase.from('cupones').select('*'); setCuponesDB((data as Cupon[]) || []); }} className="p-2 bg-zinc-900 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mostrarModalClientes && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setMostrarModalClientes(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <h2 className="text-xl md:text-2xl font-black uppercase italic text-white mb-6">Seleccionar Cliente</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 text-heraco" size={18} />
              <input type="text" placeholder="Buscar cliente..." className="w-full bg-black border border-zinc-800 p-3 pl-10 rounded-xl outline-none focus:border-heraco font-bold" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              <button onClick={() => { setClienteSeleccionado(null); setMostrarModalClientes(false); setBusqueda(''); }} className="w-full text-left p-4 rounded-xl border border-zinc-800 hover:border-heraco bg-black transition-all">
                <span className="font-bold text-zinc-400 uppercase text-xs md:text-sm">Venta de Mostrador (Sin Registro)</span>
              </button>
              {clientesFiltrados.map(c => (
                <button key={c.id} onClick={() => { setClienteSeleccionado(c); setMostrarModalClientes(false); setBusqueda(''); }} className="w-full text-left p-4 rounded-xl border border-zinc-800 hover:border-heraco bg-zinc-900 transition-all flex items-center justify-between group">
                  <span className="font-bold uppercase group-hover:text-heraco transition-colors text-xs md:text-sm">{c.empresa}</span>
                  <CheckCircle size={16} className="text-zinc-600 group-hover:text-heraco opacity-0 group-hover:opacity-100 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {mostrarModalEgreso && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative">
            <button onClick={() => setMostrarModalEgreso(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-orange-500/20 p-3 rounded-full text-orange-500"><ArrowDownCircle size={24} /></div>
              <h2 className="text-xl md:text-2xl font-black uppercase italic text-white">Retiro de Caja</h2>
            </div>
            <form onSubmit={registrarEgreso} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">¿En qué se gastó?</label>
                <input required placeholder="Ej. Agua, Papelería..." className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-heraco outline-none font-bold" value={egresoConcepto} onChange={e => setEgresoConcepto(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">Monto retirado</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">$</span>
                  <input type="number" step="0.01" required className="w-full bg-black border border-zinc-800 rounded-2xl p-4 pl-8 text-white focus:border-heraco outline-none font-bold text-xl" value={egresoMonto} onChange={e => setEgresoMonto(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>
              <button type="submit" className="w-full bg-orange-500 text-black font-black py-4 rounded-2xl uppercase text-sm tracking-widest hover:scale-[1.02] transition-all mt-4">Registrar Salida</button>
            </form>
          </div>
        </div>
      )}

      {productoMedidas && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setProductoMedidas(null)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <div className="flex items-center gap-3 mb-2">
              <Ruler className="text-heraco" size={24} />
              <h2 className="text-xl md:text-2xl font-black uppercase italic text-white">Dimensiones</h2>
            </div>
            <p className="text-[10px] md:text-xs text-zinc-400 font-bold mb-2">Ingresa las medidas para: <span className="text-heraco">{productoMedidas.nombre}</span></p>
            {productoMedidas.tiene_ancho_fijo && (
               <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 mb-4 flex items-center gap-2">
                 <AlertCircle size={14} className="text-heraco shrink-0" />
                 <span className="text-[8px] md:text-[9px] font-black uppercase text-zinc-400 tracking-widest">Rollo Fijo: {productoMedidas.ancho_fijo_valor}m</span>
               </div>
            )}
            <form onSubmit={confirmarMedidas} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">Ancho (m)</label>
                  <input type="number" step="0.01" required className="w-full bg-black border border-zinc-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-white focus:border-heraco outline-none font-bold text-center text-lg" placeholder="1.5" value={ancho} onChange={e => setAncho(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-2 block tracking-widest">Alto (m)</label>
                  <input type="number" step="0.01" required className="w-full bg-black border border-zinc-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-white focus:border-heraco outline-none font-bold text-center text-lg" placeholder="2" value={alto} onChange={e => setAlto(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 my-6 text-center">
                <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1">Costo Calculado</p>
                <p className="text-2xl md:text-3xl font-black italic text-heraco">${Number(calcularPrecioMaterial()).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <button type="submit" disabled={!ancho || !alto} className={`w-full font-black py-4 rounded-xl md:rounded-2xl uppercase text-[10px] md:text-sm tracking-widest transition-transform ${!ancho || !alto ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-heraco text-black hover:scale-[1.02]'}`}>AÑADIR A LA CUENTA</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}