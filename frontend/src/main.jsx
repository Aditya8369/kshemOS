import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { hydrateSyncQueue } from './syncQueue.js'

// Decrypt local field drafts before the first render so the outbox badge
// reflects pending work instead of briefly showing an empty queue.
hydrateSyncQueue().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
