import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

function geminiDevApiPlugin(): Plugin {
  const MAX_PAYLOAD_SIZE = 16 * 1024 // 16 KB

  return {
    name: 'gemini-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/generate-plan', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          return
        }

        const apiKey = process.env.GEMINI_API_KEY
        let body = ''
        req.on('data', chunk => {
          body += chunk
          if (body.length > MAX_PAYLOAD_SIZE) {
            res.statusCode = 413
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Payload Too Large' }))
            req.destroy()
          }
        })

        req.on('end', async () => {
          try {
            if (!apiKey) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured in server environment (.env).' }))
              return
            }

            const parsed = JSON.parse(body || '{}')
            const prompt = typeof parsed.prompt === 'string' && parsed.prompt.trim().length > 0
              ? parsed.prompt
              : undefined

            if (!prompt) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Prompt is required' }))
              return
            }

            const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash'
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,

              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { maxOutputTokens: 4096 },
                }),
              }
            )



            const data = await geminiRes.json()
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text

            res.statusCode = geminiRes.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ plan: text }))
          } catch (err: unknown) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: (err as Error).message || 'Server error' }))
          }
        })
      })
    },
  }
}


// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: 'localhost',
    port: 8080,
  },
  plugins: [
    react(),
    geminiDevApiPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
})

