import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

function generateDevPrompt(formData: Record<string, unknown>): string {
  return [
    'You are an elite exercise physiologist and sports nutritionist with 20+ years coaching experience.',
    '',
    'Generate a complete, hyper-personalized 7-day home workout and meal schedule based on these exact client metrics:',
    '',
    'Client Metrics:',
    `- Age: ${formData.age || '25'} years`,
    `- Gender: ${formData.gender || 'Not specified'}`,
    `- Height: ${formData.height || '175'} cm`,
    `- Weight: ${formData.weight || '70'} kg`,
    `- Fitness Level: ${formData.fitnessLevel || 'Intermediate'}`,
    `- Push-ups baseline capacity: ${formData.pushupCount || 'Not specified'}`,
    '',
    'Goals & Constraints:',
    `- Primary Goal: ${formData.mainGoal || 'Build Lean Muscle'}`,
    `- Targeted Muscle Focus Areas: ${Array.isArray(formData.bodyFocus) ? formData.bodyFocus.join(', ') : 'Full Body'}`,
    `- Daily Workout Duration: ${formData.timePerDay || '45'} minutes/day`,
    `- Planned Rest / Recovery Days: ${formData.recoveryDays || '2'} days/week`,
    '',
    'Health & Gear:',
    `- Medical / Injuries / Limitations: ${formData.medicalIssues || 'None stated'}`,
    `- Available Equipment: ${Array.isArray(formData.equipment) ? formData.equipment.join(', ') : 'Bodyweight only'}`,
    '',
    'Nutrition & Recovery:',
    `- Dietary Preference: ${formData.dietaryPreference || 'Omnivore'}`,
    `- Allergies / Intolerances: ${formData.allergies || 'None'}`,
    `- Special Meal Requests: ${formData.specialRequests || 'None'}`,
    `- Nightly Sleep: ${formData.sleepHours || '7-8'} hours/night`,
    `- Stress Level: ${formData.stressLevel || 'Moderate'}`,
    '',
    'Formatting Guidelines:',
    '1. Divide clearly into 7 distinct days (Day 1 through Day 7).',
    `2. Allocate ${formData.recoveryDays || '2'} rest/active recovery days across the week.`,
    '3. For each workout day provide: 5-minute dynamic warm-up, main exercise circuit with exact sets/reps/rest, and 5-minute cool-down.',
    '4. For each day provide: Breakfast, Lunch, Dinner, and 1-2 Snacks with realistic ingredient suggestions and approximate calorie targets.',
    '5. Conclude with an inspiring motivational coaching quote.'
  ].join('\n')
}

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
            if (!parsed.formData || typeof parsed.formData !== 'object' || Array.isArray(parsed.formData)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'A valid formData object is required.' }))
              return
            }

            const prompt = generateDevPrompt(parsed.formData)
            const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'zod', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
})

