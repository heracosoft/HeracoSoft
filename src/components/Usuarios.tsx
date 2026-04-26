import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  UserPlus, Shield, User, Trash2, Pencil, X, Eye, EyeOff, Settings
} from 'lucide-react';

interface PermisosAcceso {
  dashboard: 'ninguno' | 'lectura' | 'escritura';
  prospectos: 'ninguno' | 'lectura' | 'escritura';
  clientes: 'ninguno' | 'lectura' | 'escritura';
  catalogo: 'ninguno' | 'lectura' | 'escritura';
  materiales: 'ninguno' | 'lectura' | 'escritura';
  proyectos: 'ninguno' | 'lectura' | 'escritura';
  cotizaciones: 'ninguno' | 'lectura' | 'escritura';
  equipo: 'ninguno' | 'lectura' | 'escritura';
  entregas: 'ninguno' | 'lectura' | 'escritura';
}

interface Perfil {
  id: string;
  nombre: string;
  usuario?: string; // <-- Agregado para guardar el login
  rol: 'admin' | 'empleado';
  estado: string;
  created_at: string;
  permisos: PermisosAcceso; 
}

// --- SelectorPermiso ---
const SelectorPermiso = ({ modulo, valor, onChange }: { modulo: string, valor: string, onChange: (v: any) => void }) => (
  <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/50 flex justify-between items-center">
    <span className="text-xs font-bold uppercase text-zinc-400">{modulo}</span>
    <select 
      className="bg-black border border-zinc-800 rounded-xl px-2 py-1 text-white focus:border-heraco outline-none font-bold text-xs appearance-none text-right cursor-pointer"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="ninguno">Bloqueado</option>
      <option value="lectura">Solo Ver</option>
      <option value="escritura">Ver y Editar</option>
    </select>
  </div>
);

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [mostrarModalEdit, setMostrarModalEdit] = useState(false);
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [verPassword, setVerPassword] = useState(false);

  // --- NUEVOS ESTADOS PARA CONTROLAR LA EDICIÓN PROTEGIDA ---
  const [editUsername, setEditUsername] = useState(false);
  const [editPassword, setEditPassword] = useState(false);
  const [passwordActual, setPasswordActual] = useState('');

  const permisosPorDefecto: PermisosAcceso = {
    dashboard: 'lectura',
    prospectos: 'ninguno',
    clientes: 'ninguno',
    catalogo: 'lectura',
    materiales: 'ninguno',
    proyectos: 'lectura',
    cotizaciones: 'ninguno',
    equipo: 'ninguno',
    entregas: 'lectura'
  };

  const [formData, setFormData] = useState({
    nombre: '',
    usuario: '', 
    password: '', 
    rol: 'empleado' as 'admin' | 'empleado',
    permisos: permisosPorDefecto
  });

  const traerUsuarios = useCallback(async () => {
    const { data, error } = await supabase.from('perfiles').select('*').order('created_at', { ascending: false });
    if (!error && data) setUsuarios(data as Perfil[]);
    setCargando(false);
  }, []);

  useEffect(() => { 
    traerUsuarios(); 
  }, [traerUsuarios]);

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);

    const emailVirtual = `${formData.usuario.toLowerCase().trim()}@heracosoft.mx`;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emailVirtual,
      password: formData.password,
      options: {
        data: {
          nombre: formData.nombre,
          rol: formData.rol,
          permisos: formData.rol === 'admin' ? permisosPorDefecto : formData.permisos 
        }
      }
    });

    if (authError) {
      alert("Error al crear acceso: " + authError.message);
    } else {
      // Guardamos explícitamente el 'usuario' en la tabla perfiles para poder mostrarlo después
      if (authData.user) {
        await supabase.from('perfiles').update({ usuario: formData.usuario }).eq('id', authData.user.id);
      }
      alert(`¡Usuario ${formData.nombre} creado con éxito!`);
      setMostrarModalNuevo(false);
      setFormData({ nombre: '', usuario: '', password: '', rol: 'empleado', permisos: permisosPorDefecto });
      traerUsuarios();
    }
    setCargando(false);
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;

    const { data: { user } } = await supabase.auth.getUser();

    // 1. VALIDACIÓN DE CAMBIO DE CONTRASEÑA PROTEGIDO
    if (editPassword && formData.password.trim() !== '') {
      if (!passwordActual) return alert("⚠️ Debes escribir tu contraseña actual para autorizar el cambio.");

      if (user && user.id === editando.id) {
        // Verificamos si la contraseña actual es correcta intentando un mini-login
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: passwordActual
        });

        if (verifyError) {
          return alert("❌ La contraseña actual es incorrecta. No se guardaron los cambios.");
        }

        // Si es correcta, actualizamos a la nueva
        const { error: errorAuth } = await supabase.auth.updateUser({ password: formData.password });
        if (errorAuth) return alert("Error al actualizar la contraseña: " + errorAuth.message);
      } else {
        return alert("❌ Regla de Supabase: Solo puedes cambiar tu propia contraseña verificando la actual. No puedes forzar el cambio de la contraseña de otro usuario desde aquí.");
      }
    }

    // 2. VALIDACIÓN DE CAMBIO DE USUARIO (EMAIL VIRTUAL)
    if (editUsername && formData.usuario.trim() !== '' && formData.usuario !== editando.usuario) {
      if (user && user.id === editando.id) {
        const nuevoEmail = `${formData.usuario.toLowerCase().trim()}@heracosoft.mx`;
        await supabase.auth.updateUser({ email: nuevoEmail });
      } else {
        alert("⚠️ Actualizaremos el nombre y permisos, pero no puedes cambiar el usuario de login de otra persona.");
      }
    }

    // 3. ACTUALIZAR LOS DATOS PÚBLICOS EN LA BASE DE DATOS
    const { error } = await supabase
      .from('perfiles')
      .update({ 
        nombre: formData.nombre, 
        usuario: formData.usuario, // Guardamos el usuario modificado
        rol: formData.rol,
        permisos: formData.rol === 'admin' ? permisosPorDefecto : formData.permisos
      })
      .eq('id', editando.id);

    if (!error) {
      alert("✅ Cambios guardados con éxito.");
      setMostrarModalEdit(false);
      setEditando(null);
      
      // Reseteamos los estados de edición
      setEditUsername(false);
      setEditPassword(false);
      setPasswordActual('');
      setVerPassword(false);
      
      traerUsuarios();
    }
  };

  // --- LÓGICA DE ELIMINACIÓN ACTUALIZADA CON FUNCIÓN RPC ---
  const eliminarUsuario = async (id: string, nombre: string) => {
    if (nombre === 'EHEREDIA') return alert("No puedes eliminar al admin principal.");
    
    if (window.confirm(`¿Seguro que quieres eliminar a ${nombre} POR COMPLETO?\nSe borrará su cuenta y perderá el acceso al sistema para siempre.`)) {
      // Llamamos a la función segura que creamos en SQL
      const { error } = await supabase.rpc('borrar_usuario_auth', { user_id: id });
      
      if (error) {
        alert("Error al eliminar el usuario: " + error.message);
      } else {
        alert(`El usuario ${nombre} ha sido eliminado del sistema exitosamente.`);
        traerUsuarios();
      }
    }
  };

  const abrirModalEdicion = (u: Perfil) => {
    setEditando(u);
    setEditUsername(false);
    setEditPassword(false);
    setPasswordActual('');
    setFormData({ 
      nombre: u.nombre, 
      usuario: u.usuario || '', 
      password: '', 
      rol: u.rol, 
      permisos: u.permisos || permisosPorDefecto 
    });
    setMostrarModalEdit(true);
  };

  return (
    <div className="p-8 bg-black min-h-screen text-white font-sans">
      <header className="flex justify-between items-center mb-10 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">Equipo Heraco</h1>
          <p className="text-heraco font-bold text-sm tracking-widest uppercase italic">Gestión de Accesos</p>
        </div>
        
        <button 
          onClick={() => {
            setFormData({ nombre: '', usuario: '', password: '', rol: 'empleado', permisos: permisosPorDefecto });
            setMostrarModalNuevo(true);
          }}
          className="bg-heraco text-black font-black py-4 px-8 rounded-2xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg text-xs"
        >
          <UserPlus size={18} /> AGREGAR MIEMBRO
        </button>
      </header>

      {cargando && !usuarios.length ? (
        <div className="flex justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-4 border-heraco border-t-transparent"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {usuarios.map((u) => (
            <div key={u.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2.5rem] hover:border-heraco/50 transition-all group relative">
              <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => abrirModalEdicion(u)} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white"><Pencil size={18} /></button>
                <button onClick={() => eliminarUsuario(u.id, u.nombre)} className="p-2 hover:bg-red-500/10 rounded-xl text-zinc-400 hover:text-red-500"><Trash2 size={18} /></button>
              </div>

              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${u.rol === 'admin' ? 'bg-heraco text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                {u.rol === 'admin' ? <Shield size={28} /> : <User size={28} />}
              </div>

              <h3 className="text-xl font-black uppercase italic leading-none">{u.nombre}</h3>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-2 mb-4">{u.rol}</p>
              
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-heraco rounded-full animate-pulse"></span>
                <span className="text-[9px] font-black uppercase text-zinc-400">Acceso Activo</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL NUEVO USUARIO --- */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setMostrarModalNuevo(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <h2 className="text-2xl font-black uppercase italic text-heraco mb-6">Nuevo Miembro</h2>
            
            <form onSubmit={handleCrearUsuario} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-4 mb-2 block tracking-widest">Nombre Completo</label>
                <input required className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-heraco outline-none font-bold" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-4 mb-2 block tracking-widest">Usuario (Login)</label>
                  <input required placeholder="ej: quique" className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-heraco outline-none font-bold uppercase" value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-4 mb-2 block tracking-widest">Rol Principal</label>
                  <select className="w-full h-14.5 bg-black border border-zinc-800 rounded-2xl px-4 text-white focus:border-heraco outline-none font-bold appearance-none" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value as 'admin' | 'empleado'})}>
                    <option value="empleado">EMPLEADO</option>
                    <option value="admin">ADMIN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-4 mb-2 block tracking-widest">Contraseña Temporal</label>
                <div className="relative">
                  <input type={verPassword ? "text" : "password"} required className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-heraco outline-none font-bold" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  <button type="button" onClick={() => setVerPassword(!verPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-heraco">
                    {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {formData.rol === 'empleado' && (
                <div className="mt-6 pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings size={16} className="text-heraco" />
                    <h3 className="text-xs font-black uppercase text-heraco tracking-widest">Permisos Detallados</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <SelectorPermiso modulo="Dashboard" valor={formData.permisos.dashboard} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, dashboard: v}})} />
                    <SelectorPermiso modulo="Prospectos" valor={formData.permisos.prospectos} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, prospectos: v}})} />
                    <SelectorPermiso modulo="Clientes" valor={formData.permisos.clientes} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, clientes: v}})} />
                    <SelectorPermiso modulo="Catálogo" valor={formData.permisos.catalogo} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, catalogo: v}})} />
                    <SelectorPermiso modulo="Materiales" valor={formData.permisos.materiales} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, materiales: v}})} />
                    <SelectorPermiso modulo="Proyectos" valor={formData.permisos.proyectos} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, proyectos: v}})} />
                    <SelectorPermiso modulo="Cotizaciones" valor={formData.permisos.cotizaciones} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, cotizaciones: v}})} />
                    <SelectorPermiso modulo="Entregas" valor={formData.permisos.entregas} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, entregas: v}})} />
                    <SelectorPermiso modulo="Equipo (Admin)" valor={formData.permisos.equipo} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, equipo: v}})} />
                  </div>
                </div>
              )}

              <button type="submit" className="w-full bg-heraco text-black font-black py-5 rounded-2xl uppercase text-xs tracking-widest hover:scale-[1.02] transition-all mt-4">
                CREAR ACCESO OFICIAL
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR CON NUEVO DISEÑO --- */}
      {mostrarModalEdit && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setMostrarModalEdit(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X size={24} /></button>
            <h2 className="text-2xl font-black uppercase italic text-heraco mb-6">Editar Usuario</h2>
            
            <form onSubmit={handleGuardarEdicion} className="space-y-6">
               <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-4 mb-2 block tracking-widest">Nombre Completo</label>
                  <input className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-heraco" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 
                 {/* CAMPO USUARIO PROTEGIDO */}
                 <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Usuario Actual</label>
                      {!editUsername && (
                        <button type="button" onClick={() => setEditUsername(true)} className="text-heraco text-[10px] uppercase font-black tracking-widest flex items-center gap-1 hover:text-white transition-colors">
                          <Pencil size={12}/> Editar
                        </button>
                      )}
                    </div>
                    
                    {!editUsername ? (
                      <p className="text-white font-bold text-sm tracking-widest uppercase">{formData.usuario || 'NO REGISTRADO'}</p>
                    ) : (
                      <div className="flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                        <input required placeholder="Nuevo usuario..." className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-heraco outline-none font-bold text-sm uppercase" value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})} />
                        <button type="button" onClick={() => {setEditUsername(false); setFormData({...formData, usuario: editando?.usuario || ''})}} className="text-zinc-500 hover:text-red-500 p-2"><X size={18}/></button>
                      </div>
                    )}
                 </div>

                 {/* CAMPO CONTRASEÑA PROTEGIDO */}
                 <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Contraseña</label>
                      {!editPassword && (
                        <button type="button" onClick={() => setEditPassword(true)} className="text-heraco text-[10px] uppercase font-black tracking-widest flex items-center gap-1 hover:text-white transition-colors">
                          <Pencil size={12}/> Editar
                        </button>
                      )}
                    </div>

                    {!editPassword ? (
                      <p className="text-zinc-500 font-black text-sm tracking-widest">••••••••••</p>
                    ) : (
                      <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <input type={verPassword ? "text" : "password"} placeholder="Contraseña Actual" required className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-heraco outline-none font-bold text-sm placeholder:text-zinc-600" value={passwordActual} onChange={e => setPasswordActual(e.target.value)} />
                        
                        <div className="relative">
                          <input type={verPassword ? "text" : "password"} placeholder="Nueva Contraseña" required className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-heraco outline-none font-bold text-sm placeholder:text-zinc-600" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                          <button type="button" onClick={() => setVerPassword(!verPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-heraco">
                            {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <button type="button" onClick={() => {setEditPassword(false); setPasswordActual(''); setFormData({...formData, password: ''})}} className="text-[9px] text-zinc-500 hover:text-red-500 uppercase font-black tracking-widest w-full text-right block pt-1">Cancelar edición</button>
                      </div>
                    )}
                 </div>
               </div>

               <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-4 mb-2 block tracking-widest">Rol Principal</label>
                  <select className="w-full h-14 bg-black border border-zinc-800 rounded-2xl px-4 text-white font-bold appearance-none outline-none focus:border-heraco" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value as 'admin' | 'empleado'})}>
                    <option value="empleado">EMPLEADO</option>
                    <option value="admin">ADMIN</option>
                  </select>
               </div>

               {formData.rol === 'empleado' && (
                <div className="mt-6 pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings size={16} className="text-heraco" />
                    <h3 className="text-xs font-black uppercase text-heraco tracking-widest">Niveles de Acceso</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <SelectorPermiso modulo="Dashboard" valor={formData.permisos.dashboard} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, dashboard: v}})} />
                    <SelectorPermiso modulo="Prospectos" valor={formData.permisos.prospectos} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, prospectos: v}})} />
                    <SelectorPermiso modulo="Clientes" valor={formData.permisos.clientes} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, clientes: v}})} />
                    <SelectorPermiso modulo="Catálogo" valor={formData.permisos.catalogo} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, catalogo: v}})} />
                    <SelectorPermiso modulo="Materiales" valor={formData.permisos.materiales} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, materiales: v}})} />
                    <SelectorPermiso modulo="Proyectos" valor={formData.permisos.proyectos} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, proyectos: v}})} />
                    <SelectorPermiso modulo="Cotizaciones" valor={formData.permisos.cotizaciones} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, cotizaciones: v}})} />
                    <SelectorPermiso modulo="Entregas" valor={formData.permisos.entregas} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, entregas: v}})} />
                    <SelectorPermiso modulo="Equipo (Admin)" valor={formData.permisos.equipo} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, equipo: v}})} />
                  </div>
                </div>
              )}

               <button type="submit" className="w-full bg-heraco text-black font-black py-5 rounded-2xl uppercase text-xs transition-all mt-4 hover:scale-[1.02]">GUARDAR CAMBIOS</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}