import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './users/index.css'
import App from './users/App.jsx'
import { API_BASE_URL, LEGACY_BASE_URL } from './apiConfig'

axios.interceptors.request.use((config) => {
	if (typeof config.url === 'string' && config.url.startsWith(LEGACY_BASE_URL)) {
		config.url = `${API_BASE_URL}${config.url.slice(LEGACY_BASE_URL.length)}`
	}

	return config
})

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
