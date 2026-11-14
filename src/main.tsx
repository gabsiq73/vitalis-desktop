import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ApiReadinessGate } from './components/ApiReadinessGate'

async function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ApiReadinessGate><App /></ApiReadinessGate>
    </React.StrictMode>,
  )
}

void render()
