import fs from 'node:fs'
import path from 'node:path'
const [sourcePath, dataRoot, modelKey, baseUrl] = process.argv.slice(2)
if (!sourcePath || !path.isAbsolute(dataRoot || '') || !modelKey || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl || '')) throw new Error('Usage: node seed-local-comfyui.mjs <read-only catalog> <dedicated web data root> <verified model key> <independent loopback URL>')
fs.mkdirSync(dataRoot, { recursive: true, mode: 0o700 })
if (fs.realpathSync(dataRoot) !== path.resolve(dataRoot) || /(?:^|\/)nomi-data(?:\/|$)/.test(dataRoot)) throw new Error('Web data must have an independent real directory')
const profileRoot = path.join(dataRoot, 'profile')
fs.mkdirSync(profileRoot, { recursive: true, mode: 0o700 })
if (fs.realpathSync(profileRoot) !== profileRoot) throw new Error('Profile cannot be a symlink')
const target = path.join(profileRoot, 'model-catalog.json')
if (fs.existsSync(target)) throw new Error('Web catalog already exists; it will not be overwritten')
const catalog = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
/**
 * 写入**本应用自己的** catalog 版本，而不是照抄来源文件的版本（2026-10-13 实机）。
 * 来源（桌面端的已验证 catalog）可能来自更新的应用（如 v14），照抄会让 web 端的 v13 应用
 * 把这份文件判成「更高版本写的」→ **整份只读**：模型设置读得到、改不了，界面只说「请更新
 * 应用」。版本必须由应用自己决定；来源版本比应用新时直接拒绝，别造一份改不动的文件。
 */
const appCatalogVersion = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'electron/catalog/catalogVersion.json'), 'utf8')).current
if (typeof catalog.version !== 'number') throw new Error('Source catalog has no numeric version')
if (catalog.version > appCatalogVersion) throw new Error(`Source catalog version ${catalog.version} is newer than this app's ${appCatalogVersion}; use a source this app can own`)
const originalModel = catalog.models.find(model => model.modelKey === modelKey)
const originalVendor = catalog.vendors.find(vendor => vendor.key === originalModel?.vendorKey)
if (!originalModel?.enabled || !originalVendor || originalVendor.authType !== 'none' || !originalVendor.key.startsWith('comfyui-local')) throw new Error('Only an enabled local, auth-none ComfyUI model can be seeded')
const copy = value => JSON.parse(JSON.stringify(value).replaceAll('nomi-evaluation/h3', 'nomi-web-evaluation/h3'))
const vendor = { ...copy(originalVendor), baseUrlHint: baseUrl }
const model = copy(originalModel)
const mappings = copy(catalog.mappings.filter(mapping => mapping.vendorKey === vendor.key && mapping.modelKey === model.modelKey)).map(mapping => ({ ...mapping,
  create: JSON.parse(JSON.stringify(mapping.create).replaceAll(originalVendor.baseUrlHint, baseUrl)),
  query: JSON.parse(JSON.stringify(mapping.query).replaceAll(originalVendor.baseUrlHint, baseUrl)),
}))
if (!mappings.length) throw new Error('Verified workflow mapping is missing')
fs.writeFileSync(target, JSON.stringify({ version: appCatalogVersion, vendors: [vendor], models: [model], mappings, apiKeysByVendor: {} }, null, 2), { mode: 0o600, flag: 'wx' })
const defaults = path.join(profileRoot, 'generation-model-defaults.json')
if (!fs.existsSync(defaults)) fs.writeFileSync(defaults, JSON.stringify({ schemaVersion: 1, byTaskKind: { text_to_video: { vendorKey: vendor.key, modelKey: model.modelKey } } }, null, 2), { mode: 0o600, flag: 'wx' })
console.log(JSON.stringify({ event: 'local-comfyui-seeded', modelKey, vendorKey: vendor.key, mappingCount: mappings.length }))
