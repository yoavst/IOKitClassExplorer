import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { Toaster } from 'sonner'
import './index.css'

ModuleRegistry.registerModules([AllCommunityModule])

const root = document.getElementById('root')
if (root !== null) {
    createRoot(root).render(
        <StrictMode>
            <App />
            <Toaster theme="dark" duration={2000} />
        </StrictMode>
    )
}
