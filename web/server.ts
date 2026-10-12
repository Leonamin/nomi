import './runtimeHost'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { bodyLimit } from 'hono/body-limit'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { hostEvents } from './runtimeHost'
import { dispatchWebRpc, getWebSurface, uploadWebAsset, initWebDomain } from './rpc'
import { translateMediaValues } from './mediaUrls'
import { handleNomiLocalRequest } from '../electron/protocol/localProtocol'

const port = Number(process.env.NOMI_WEB_PORT || 9031)
const origin = process.env.NOMI_WEB_ORIGIN || `http://127.0.0.1:${port}`
const token = randomBytes(32).toString('hex')
const app = new Hono()
const rpcSchema = z.object({ channel: z.string().max(100), args: z.array(z.unknown()).max(4) }).strict()
app.use('*', async (context, next) => {
  const host = context.req.header('host')
  const incomingOrigin = context.req.header('origin')
  if (host !== new URL(origin).host || (incomingOrigin && incomingOrigin !== origin)) return context.json({ ok: false, error: 'Untrusted origin' }, 403)
  context.header('X-Content-Type-Options', 'nosniff')
  context.header('Cross-Origin-Opener-Policy', 'same-origin')
  context.header('Cross-Origin-Embedder-Policy', 'require-corp')
  context.header('Referrer-Policy', 'same-origin')
  await next()
})
app.use('/api/*', async (context, next) => {
  context.header('Cache-Control', 'no-store')
  if (context.req.method !== 'GET' && context.req.method !== 'HEAD' && context.req.header('x-nomi-token') !== token) return context.json({ ok: false, error: 'Reload the browser to reconnect to this server' }, 403)
  await next()
})
app.get('/api/session', context => context.json({ token }))
app.get('/api/health', context => context.json({ status: 'ok', version: '0.23.1-web', commit: process.env.NOMI_BUILD_SHA || 'development' }))
app.post('/api/rpc', bodyLimit({ maxSize: 8 * 1024 * 1024 }), async context => {
  const { channel, args } = rpcSchema.parse(await context.req.json())
  const surface = getWebSurface(context.req.header('x-nomi-client') || '', origin)
  const value = await dispatchWebRpc(channel, translateMediaValues(args, 'server') as unknown[], surface)
  return context.json({ ok: true, value: translateMediaValues(value, 'browser') ?? null })
})
app.post('/api/upload', bodyLimit({ maxSize: 256 * 1024 * 1024 }), async context => {
  const form = await context.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new Error('A media file is required')
  const payload = z.object({ projectId: z.string() }).passthrough().parse(JSON.parse(String(form.get('payload'))))
  const value = await uploadWebAsset(getWebSurface(context.req.header('x-nomi-client') || '', origin), payload, file)
  return context.json({ ok: true, value: translateMediaValues(value, 'browser') })
})
app.get('/api/events', context => streamSSE(context, async stream => {
  await stream.writeSSE({ data: JSON.stringify({ channel: 'nomi:web:session', payload: { token } }) })
  const forward = (message: unknown) => { void stream.writeSSE({ data: JSON.stringify(translateMediaValues(message, 'browser')) }).catch(() => undefined) }
  hostEvents.on('message', forward)
  await new Promise<void>(resolve => stream.onAbort(() => { hostEvents.off('message', forward); resolve() }))
}))
app.on(['GET', 'HEAD'], ['/api/media/*', '/api/download/*'], async context => {
  const requestPath = new URL(context.req.url).pathname
  const isDownload = requestPath.startsWith('/api/download/')
  const mediaPath = requestPath.slice(isDownload ? '/api/download/'.length : '/api/media/'.length)
  const relativePath = mediaPath.split('/').slice(1).map(decodeURIComponent).join('/')
  if (!/^(?:assets\/|exports\/)/.test(relativePath) || !/\.(png|jpe?g|webp|gif|mp4|webm|mov|m4a|wav|mp3|ogg|flac)$/i.test(relativePath)) return context.notFound()
  const response = await handleNomiLocalRequest(new Request(`nomi-local://asset/${mediaPath}`, { headers: context.req.raw.headers, method: context.req.method }))
  if (isDownload) response.headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(relativePath))}`)
  return response
})
app.get('/source', context => context.redirect(`https://github.com/Leonamin/nomi-web/tree/${process.env.NOMI_BUILD_SHA || 'main'}`))
app.get('/LICENSE', context => context.text(fs.readFileSync(path.join(process.cwd(), 'LICENSE'), 'utf8')))
app.get('*', serveStatic({ root: './dist/web/client' }))
app.onError((error, context) => {
  console.error('Web request failed:', error.message)
  return context.json({ ok: false, error: error.message }, error instanceof z.ZodError ? 400 : 422)
})
initWebDomain()
serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, info => console.log(`Nomi Web listening at ${origin} (loopback ${info.port})`))
