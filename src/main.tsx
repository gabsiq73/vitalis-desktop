import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { configureApi } from './api/http'

async function render() {
  const desktop = window.vitalis
  if (desktop) configureApi(await desktop.getApiUrl())
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void render()
