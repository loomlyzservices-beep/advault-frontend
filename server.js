// Minimal static file server so this frontend can be deployed on Railway
// exactly like the backend (npm install && npm start).
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 4173

const app = express()
app.use(express.static(__dirname))
// Single-page app: any unknown route falls back to index.html
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')))

app.listen(PORT, () => console.log(`Advault frontend listening on port ${PORT}`))
