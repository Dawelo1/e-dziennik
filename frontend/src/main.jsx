import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './users/index.css'
import App from './users/App.jsx'
import { API_BASE_URL } from './apiConfig'

axios.defaults.baseURL = API_BASE_URL

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
