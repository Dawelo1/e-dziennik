import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './users/index.css'
import App from './users/App.jsx'

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
