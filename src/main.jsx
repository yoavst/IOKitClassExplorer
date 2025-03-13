import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Explorer from './Pages/Explorer.jsx'

const root = document.getElementById('root')
if (root !== null) {
    createRoot(root).render(
        <StrictMode>
            <Explorer />
        </StrictMode>
    )
}
