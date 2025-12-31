import './styles/global.css'
import { supabase } from './config/supabase'

// Verificar conexión con Supabase
console.log('Supabase inicializado:', supabase)

// Router básico (lo desarrollaremos después)
// import { initRouter } from './router'
// initRouter()

document.querySelector('#app').innerHTML = `
  <div>
    <h1>Bienvenido al SaaS de Catálogos</h1>
    <p>Proyecto inicializado correctamente</p>
    <a href="/src/pages/login/index.html">Ir al login</a>
  </div>
`