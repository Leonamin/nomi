import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
process.env.NOMI_WEB_DATA_DIR = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-web-test-')))
