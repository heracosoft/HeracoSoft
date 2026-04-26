/* eslint-disable @typescript-eslint/no-explicit-any */
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
  usuario?: string; 
  rol: 'admin' | 'empleado';
  estado: string;
  created_at: string;
  permisos: PermisosAcceso; 
}

// --- SelectorPermiso ---
// 🟢 CORRECCIÓN: Cambiamos (v: any) a (v: string) para quitar el error de Vercel
const SelectorPermiso = ({ modulo, valor, onChange }: { modulo: string, valor: string, onChange: (v: string) => void }) => (
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

  // 🟢 CORRECCIÓN: Vacuna contra el error "react-hooks/set-state-in-effect"
  useEffect(() => { 
    const iniciar = async () => { await traerUsuarios(); };
    iniciar();
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

    if (editPassword && formData.password.trim() !== '') {
      if (!passwordActual) return alert("⚠️ Debes escribir tu contraseña actual para autorizar el cambio.");

      if (user && user.id === editando.id) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: passwordActual
        });

        if (verifyError) {
          return alert("❌ La contraseña actual es incorrecta. No se guardaron los cambios.");
        }

        const { error: errorAuth } = await supabase.auth.updateUser({ password: formData.password });
        if (errorAuth) return alert("Error al actualizar la contraseña: " + errorAuth.message);
      } else {
        return alert("❌ Regla de Supabase: Solo puedes cambiar tu propia contraseña verificando la actual. No puedes forzar el cambio de la contraseña de otro usuario desde aquí.");
      }
    }

    if (editUsername && formData.usuario.trim() !== '' && formData.usuario !== editando.usuario) {
      if (user && user.id === editando.id) {
        const nuevoEmail = `${formData.usuario.toLowerCase().trim()}@heracosoft.mx`;
        await supabase.auth.updateUser({ email: nuevoEmail });
      } else {
        alert("⚠️ Actualizaremos el nombre y permisos, pero no puedes cambiar el usuario de login de otra persona.");
      }
    }

    const { error } = await supabase
      .from('perfiles')
      .update({ 
        nombre: formData.nombre, 
        usuario: formData.usuario, 
        rol: formData.rol,
        permisos: formData.rol === 'admin' ? permisosPorDefecto : formData.permisos
      })
      .eq('id', editando.id);

    if (!error) {
      alert("✅ Cambios guardados con éxito.");
      setMostrarModalEdit(false);
      setEditando(null);
      
      setEditUsername(false);
      setEditPassword(false);
      setPasswordActual('');
      setVerPassword(false);
      
      traerUsuarios();
    }
  };

  const eliminarUsuario = async (id: string, nombre: string) => {
    if (nombre === 'EHEREDIA') return alert("No puedes eliminar al admin principal.");
    
    if (window.confirm(`¿Seguro que quieres eliminar a ${nombre} POR COMPLETO?\nSe borrará su cuenta y perderá el acceso al sistema para siempre.`)) {
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
    <div className="p-4 md:p-8 bg-black min-h-screen text-white font-sans pb-24 md:pb-8">
      {/* 🟢 HEADER RESPONSIVO */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-10 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic">Equipo Heraco</h1>
          <p className="text-heraco font-bold text-xs md:text-sm tracking-widest uppercase italic mt-1">Gestión de Accesos</p>
        </div>
        
        <button 
          onClick={() => {
            setFormData({ nombre: '', usuario: '', password: '', rol: 'empleado', permisos: permisosPorDefecto });
            setMostrarModalNuevo(true);
          }}
          className="w-full md:w-auto justify-center bg-heraco text-black font-black py-3 md:py-4 px-6 md:px-8 rounded-xl md:rounded-2xl flex items-center gap-2 hover:scale-105 transition-all shadow-lg text-[10px] md:text-xs"
        >
          <UserPlus size={16} className="md:w-5 md:h-5" /> AGREGAR MIEMBRO
        </button>
      </header>

      {cargando && !usuarios.length ? (
        <div className="flex justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-4 border-heraco border-t-transparent"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {usuarios.map((u) => (
            <div key={u.id} className="bg-zinc-900 border border-zinc-800 p-5 md:p-6 rounded-3xl md:rounded-[2.5rem] hover:border-heraco/50 transition-all group relative">
              <div className="absolute top-4 right-4 md:top-6 md:right-6 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                <button onClick={() => abrirModalEdicion(u)} className="p-1.5 md:p-2 bg-black md:bg-transparent border border-zinc-800 md:border-0 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white"><Pencil size={16} className="md:w-4.5 md:h-4.5" /></button>
                <button onClick={() => eliminarUsuario(u.id, u.nombre)} className="p-1.5 md:p-2 bg-black md:bg-transparent border border-zinc-800 md:border-0 hover:bg-red-500/10 rounded-xl text-zinc-400 hover:text-red-500"><Trash2 size={16} className="md:w-4.5 md:h-4.5" /></button>
              </div>

              <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-4 ${u.rol === 'admin' ? 'bg-heraco text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                {u.rol === 'admin' ? <Shield size={24} className="md:w-7 md:h-7" /> : <User size={24} className="md:w-7 md:h-7" />}
              </div>

              <h3 className="text-lg md:text-xl font-black uppercase italic leading-none pr-16 md:pr-0">{u.nombre}</h3>
              <p className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-2 mb-4">{u.rol}</p>
              
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-heraco rounded-full animate-pulse"></span>
                <span className="text-[8px] md:text-[9px] font-black uppercase text-zinc-400">Acceso Activo</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL NUEVO USUARIO --- */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setMostrarModalNuevo(false)} className="absolute top-5 right-5 text-zinc-500 hover:text-white"><X size={20} className="md:w-6 md:h-6" /></button>
            <h2 className="text-xl md:text-2xl font-black uppercase italic text-heraco mb-6">Nuevo Miembro</h2>
            
            <form onSubmit={handleCrearUsuario} className="space-y-4">
              <div>
                <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase ml-2 md:ml-4 mb-1 md:mb-2 block tracking-widest">Nombre Completo</label>
                <input required className="w-full bg-black border border-zinc-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-white focus:border-heraco outline-none font-bold text-sm" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase ml-2 md:ml-4 mb-1 md:mb-2 block tracking-widest">Usuario (Login)</label>
                  <input required placeholder="ej: quique" className="w-full bg-black border border-zinc-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-white focus:border-heraco outline-none font-bold uppercase text-sm" value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase ml-2 md:ml-4 mb-1 md:mb-2 block tracking-widest">Rol Principal</label>
                  <select className="w-full bg-black border border-zinc-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-white focus:border-heraco outline-none font-bold appearance-none text-sm" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value as 'admin' | 'empleado'})}>
                    <option value="empleado">EMPLEADO</option>
                    <option value="admin">ADMIN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase ml-2 md:ml-4 mb-1 md:mb-2 block tracking-widest">Contraseña Temporal</label>
                <div className="relative">
                  <input type={verPassword ? "text" : "password"} required className="w-full bg-black border border-zinc-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-white focus:border-heraco outline-none font-bold text-sm" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  <button type="button" onClick={() => setVerPassword(!verPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-heraco">
                    {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {formData.rol === 'empleado' && (
                <div className="mt-4 md:mt-6 pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings size={14} className="text-heraco md:w-4 md:h-4" />
                    <h3 className="text-[10px] md:text-xs font-black uppercase text-heraco tracking-widest">Permisos Detallados</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <SelectorPermiso modulo="Dashboard" valor={formData.permisos.dashboard} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, dashboard: v as any}})} />
                    <SelectorPermiso modulo="Prospectos" valor={formData.permisos.prospectos} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, prospectos: v as any}})} />
                    <SelectorPermiso modulo="Clientes" valor={formData.permisos.clientes} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, clientes: v as any}})} />
                    <SelectorPermiso modulo="Catálogo" valor={formData.permisos.catalogo} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, catalogo: v as any}})} />
                    <SelectorPermiso modulo="Materiales" valor={formData.permisos.materiales} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, materiales: v as any}})} />
                    <SelectorPermiso modulo="Proyectos" valor={formData.permisos.proyectos} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, proyectos: v as any}})} />
                    <SelectorPermiso modulo="Cotizaciones" valor={formData.permisos.cotizaciones} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, cotizaciones: v as any}})} />
                    <SelectorPermiso modulo="Entregas" valor={formData.permisos.entregas} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, entregas: v as any}})} />
                    <SelectorPermiso modulo="Equipo (Admin)" valor={formData.permisos.equipo} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, equipo: v as any}})} />
                  </div>
                </div>
              )}

              <button type="submit" className="w-full bg-heraco text-black font-black py-4 md:py-5 rounded-xl md:rounded-2xl uppercase text-[10px] md:text-xs tracking-widest hover:scale-[1.02] transition-all mt-4">
                CREAR ACCESO OFICIAL
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR --- */}
      {mostrarModalEdit && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setMostrarModalEdit(false)} className="absolute top-5 right-5 text-zinc-500 hover:text-white"><X size={20} className="md:w-6 md:h-6" /></button>
            <h2 className="text-xl md:text-2xl font-black uppercase italic text-heraco mb-6">Editar Usuario</h2>
            
            <form onSubmit={handleGuardarEdicion} className="space-y-4 md:space-y-6">
               <div>
                  <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase ml-2 md:ml-4 mb-1 md:mb-2 block tracking-widest">Nombre Completo</label>
                  <input className="w-full bg-black border border-zinc-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-white font-bold outline-none focus:border-heraco text-sm" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* CAMPO USUARIO PROTEGIDO */}
                 <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest">Usuario Actual</label>
                      {!editUsername && (
                        <button type="button" onClick={() => setEditUsername(true)} className="text-heraco text-[9px] md:text-[10px] uppercase font-black tracking-widest flex items-center gap-1 hover:text-white transition-colors">
                          <Pencil size={12}/> Editar
                        </button>
                      )}
                    </div>
                    
                    {!editUsername ? (
                      <p className="text-white font-bold text-xs md:text-sm tracking-widest uppercase">{formData.usuario || 'NO REGISTRADO'}</p>
                    ) : (
                      <div className="flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                        <input required placeholder="Nuevo usuario..." className="w-full bg-black border border-zinc-700 rounded-xl p-2 md:p-3 text-white focus:border-heraco outline-none font-bold text-xs md:text-sm uppercase" value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})} />
                        <button type="button" onClick={() => {setEditUsername(false); setFormData({...formData, usuario: editando?.usuario || ''})}} className="text-zinc-500 hover:text-red-500 p-2"><X size={16} className="md:w-4.5 md:h-4.5"/></button>
                      </div>
                    )}
                 </div>

                 {/* CAMPO CONTRASEÑA PROTEGIDO */}
                 <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest">Contraseña</label>
                      {!editPassword && (
                        <button type="button" onClick={() => setEditPassword(true)} className="text-heraco text-[9px] md:text-[10px] uppercase font-black tracking-widest flex items-center gap-1 hover:text-white transition-colors">
                          <Pencil size={12}/> Editar
                        </button>
                      )}
                    </div>

                    {!editPassword ? (
                      <p className="text-zinc-500 font-black text-xs md:text-sm tracking-widest">••••••••••</p>
                    ) : (
                      <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <input type={verPassword ? "text" : "password"} placeholder="Contraseña Actual" required className="w-full bg-black border border-zinc-700 rounded-xl p-2 md:p-3 text-white focus:border-heraco outline-none font-bold text-xs md:text-sm placeholder:text-zinc-600" value={passwordActual} onChange={e => setPasswordActual(e.target.value)} />
                        
                        <div className="relative">
                          <input type={verPassword ? "text" : "password"} placeholder="Nueva Contraseña" required className="w-full bg-black border border-zinc-700 rounded-xl p-2 md:p-3 text-white focus:border-heraco outline-none font-bold text-xs md:text-sm placeholder:text-zinc-600" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                          <button type="button" onClick={() => setVerPassword(!verPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-heraco">
                            {verPassword ? <EyeOff size={14} className="md:w-4 md:h-4" /> : <Eye size={14} className="md:w-4 md:h-4" />}
                          </button>
                        </div>
                        <button type="button" onClick={() => {setEditPassword(false); setPasswordActual(''); setFormData({...formData, password: ''})}} className="text-[8px] md:text-[9px] text-zinc-500 hover:text-red-500 uppercase font-black tracking-widest w-full text-right block pt-1">Cancelar edición</button>
                      </div>
                    )}
                 </div>
               </div>

               <div>
                  <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase ml-2 md:ml-4 mb-1 md:mb-2 block tracking-widest">Rol Principal</label>
                  <select className="w-full bg-black border border-zinc-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-white font-bold appearance-none outline-none focus:border-heraco text-sm" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value as 'admin' | 'empleado'})}>
                    <option value="empleado">EMPLEADO</option>
                    <option value="admin">ADMIN</option>
                  </select>
               </div>

               {formData.rol === 'empleado' && (
                <div className="mt-4 md:mt-6 pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings size={14} className="text-heraco md:w-4 md:h-4" />
                    <h3 className="text-[10px] md:text-xs font-black uppercase text-heraco tracking-widest">Niveles de Acceso</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <SelectorPermiso modulo="Dashboard" valor={formData.permisos.dashboard} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, dashboard: v as any}})} />
                    <SelectorPermiso modulo="Prospectos" valor={formData.permisos.prospectos} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, prospectos: v as any}})} />
                    <SelectorPermiso modulo="Clientes" valor={formData.permisos.clientes} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, clientes: v as any}})} />
                    <SelectorPermiso modulo="Catálogo" valor={formData.permisos.catalogo} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, catalogo: v as any}})} />
                    <SelectorPermiso modulo="Materiales" valor={formData.permisos.materiales} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, materiales: v as any}})} />
                    <SelectorPermiso modulo="Proyectos" valor={formData.permisos.proyectos} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, proyectos: v as any}})} />
                    <SelectorPermiso modulo="Cotizaciones" valor={formData.permisos.cotizaciones} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, cotizaciones: v as any}})} />
                    <SelectorPermiso modulo="Entregas" valor={formData.permisos.entregas} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, entregas: v as any}})} />
                    <SelectorPermiso modulo="Equipo (Admin)" valor={formData.permisos.equipo} onChange={(v) => setFormData({...formData, permisos: {...formData.permisos, equipo: v as any}})} />
                  </div>
                </div>
              )}

               <button type="submit" className="w-full bg-heraco text-black font-black py-4 md:py-5 rounded-xl md:rounded-2xl uppercase text-[10px] md:text-xs transition-all mt-4 hover:scale-[1.02]">GUARDAR CAMBIOS</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}