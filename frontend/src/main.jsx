import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './users/index.css'
import App from './users/App.jsx'
import { API_BASE_URL, LEGACY_BASE_URL } from './apiConfig'

const LEGACY_API_PREFIXES = [LEGACY_BASE_URL, 'http://localhost:8000']

const remapLegacyApiUrl = (url) => {
	for (const prefix of LEGACY_API_PREFIXES) {
		if (url.startsWith(prefix)) {
			const suffix = url.slice(prefix.length)
			return `${API_BASE_URL}${suffix}`
		}
	}

	return url
}

axios.interceptors.request.use((config) => {
	if (typeof config.url === 'string') {
		config.url = remapLegacyApiUrl(config.url)
	}

	return config
})

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
