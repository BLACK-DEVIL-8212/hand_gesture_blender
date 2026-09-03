import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './ui/App'
import './ui/App.css'
import './style.css'

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
