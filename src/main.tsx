import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'
import Landing from './pages/Landing'
import Auth from './pages/Auth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/app" element={<App />} />
      </Routes>
    </BrowserRouter>
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#0a0a0a',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '13px',
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#000' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#000' } },
      }}
    />
  </StrictMode>,
)