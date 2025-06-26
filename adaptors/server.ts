import { serve } from '@hono/node-server'
import { app } from '../src/app'

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000

console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port,
}) 