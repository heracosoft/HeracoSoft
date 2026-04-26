import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient'; // <-- NUEVO: Importamos Supabase aquí
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Clientes from './components/Clientes';
import Servicios from './components/Servicios'; 
import Cotizaciones from './components/Cotizaciones'; 
import Materiales from './components/Materiales'; 
import Proyectos from './components/Proyectos';
import Leads from './components/Leads';
import Usuarios from './components/Usuarios'; 
import Entregas from './components/Entregas'; 
import Caja from './components/Caja'; // <-- AÑADIDO: Importamos el Punto de Venta
import Login from './components/Login';

interface SesionHeraco {
  user: string;
  rol: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  permisos?: any;
}

function App() {
  const [sesion, setSesion] = useState<SesionHeraco | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarSesion = async () => {
      const sesionGuardada = localStorage.getItem('heraco_session');
      
      if (sesionGuardada) {
        try {
          const datosLocal = JSON.parse(sesionGuardada);
          
          // --- EL TRUCO DE REFRESCO AUTOMÁTICO ---
          // Vamos a Supabase a traer los permisos más frescos para ignorar el caché viejo
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData.session) {
            const { data: perfil } = await supabase
              .from('perfiles')
              .select('rol, permisos')
              .eq('id', sessionData.session.user.id)
              .single();

            if (perfil) {
              // Actualizamos la mochila con los datos recién sacados del horno
              datosLocal.rol = perfil.rol;
              datosLocal.permisos = perfil.permisos;
              // Guardamos el nuevo gafete en el navegador
              localStorage.setItem('heraco_session', JSON.stringify(datosLocal));
            }
          }
          
          setSesion(datosLocal);
        } catch (e) {
          console.error("Error al leer la sesión", e);
        }
      }
      setCargando(false);
    };
    
    cargarSesion();
  }, []);

  const cerrarSesion = () => {
    localStorage.removeItem('heraco_session');
    setSesion(null);
  };

  if (cargando) return null;

  if (!sesion) {
    return <Login onLogin={(data: SesionHeraco) => setSesion(data)} />;
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-black overflow-hidden font-sans">
        
        <Sidebar onLogout={cerrarSesion} rol={sesion.rol} permisos={sesion.permisos} />
        
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/servicios" element={<Servicios />} />
            <Route path="/materiales" element={<Materiales />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/proyectos" element={<Proyectos />} />
            <Route path="/cotizaciones" element={<Cotizaciones />} />
            <Route path="/usuarios" element={<Usuarios />} />
            
            {/* <-- CORRECCIÓN: Quitamos los props sobrantes de Entregas --> */}
            <Route path="/entregas" element={<Entregas />} /> 
            
            <Route path="/caja" element={<Caja />} /> 
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;