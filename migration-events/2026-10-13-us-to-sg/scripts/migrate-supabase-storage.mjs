import { createClient } from '@supabase/supabase-js'

const BUCKET_IDS = [
  'crm-files',
  'order-confirmation-files',
  'shipper-attachments',
]
const PAGE_SIZE = 1000
const CONCURRENCY = 4
const MAX_ATTEMPTS = 3

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function retry(label, operation) {
  let lastError
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`${label} failed (attempt ${attempt}/${MAX_ATTEMPTS}); retrying...`)
        await sleep(500 * attempt)
      }
    }
  }
  throw lastError
}

async function listFiles(storage, bucketId, prefix = '') {
  const files = []
  let offset = 0

  while (true) {
    const { data, error } = await storage.from(bucketId).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`Could not list ${bucketId}/${prefix}: ${error.message}`)
    if (!data?.length) break

    for (const entry of data) {
      const fullPath = `${prefix}${entry.name}`
      if (entry.metadata) {
        files.push({ fullPath, metadata: entry.metadata })
      } else {
        files.push(...await listFiles(storage, bucketId, `${fullPath}/`))
      }
    }

    if (data.length < PAGE_SIZE) break
    offset += data.length
  }

  return files
}

async function runWithConcurrency(items, operation) {
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex]
      nextIndex += 1
      await operation(item)
    }
  })
  await Promise.all(workers)
}

const sourceUrl = required('SOURCE_SUPABASE_URL')
const sourceKey = required('SOURCE_SUPABASE_SERVICE_KEY')
const targetUrl = required('TARGET_SUPABASE_URL')
const targetKey = required('TARGET_SUPABASE_SERVICE_KEY')
const dryRun = process.env.DRY_RUN === '1'

if (new URL(sourceUrl).origin === new URL(targetUrl).origin) {
  throw new Error('Source and target URLs must be different projects.')
}
if (!dryRun && process.env.ALLOW_TARGET_OVERWRITE !== 'YES') {
  throw new Error('Set ALLOW_TARGET_OVERWRITE=YES to copy object bytes into the target.')
}

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
}
const source = createClient(sourceUrl, sourceKey, clientOptions)
const target = createClient(targetUrl, targetKey, clientOptions)

const { data: sourceBuckets, error: sourceBucketError } = await source.storage.listBuckets()
if (sourceBucketError) throw new Error(`Could not list source buckets: ${sourceBucketError.message}`)
const sourceBucketIds = new Set(sourceBuckets.map((bucket) => bucket.id))

const { data: targetBuckets, error: targetBucketError } = await target.storage.listBuckets()
if (targetBucketError) throw new Error(`Could not list target buckets: ${targetBucketError.message}`)
const targetBucketIds = new Set(targetBuckets.map((bucket) => bucket.id))

for (const bucketId of BUCKET_IDS) {
  if (!sourceBucketIds.has(bucketId)) throw new Error(`Source bucket is missing: ${bucketId}`)
  if (!targetBucketIds.has(bucketId)) throw new Error(`Target bucket is missing: ${bucketId}`)
}

let totalFiles = 0
let totalBytes = 0
let copiedFiles = 0
let copiedBytes = 0

for (const bucketId of BUCKET_IDS) {
  const files = await listFiles(source.storage, bucketId)
  console.log(`${bucketId}: discovered ${files.length} source file(s)`)
  totalFiles += files.length

  if (dryRun) continue

  await runWithConcurrency(files, async (file) => {
    const blob = await retry(`${bucketId}/${file.fullPath} download`, async () => {
      const { data, error } = await source.storage.from(bucketId).download(file.fullPath)
      if (error) throw new Error(error.message)
      return data
    })

    await retry(`${bucketId}/${file.fullPath} upload`, async () => {
      const options = { upsert: true }
      if (file.metadata?.mimetype) options.contentType = file.metadata.mimetype
      if (file.metadata?.cacheControl) options.cacheControl = file.metadata.cacheControl
      const { error } = await target.storage.from(bucketId).upload(file.fullPath, blob, options)
      if (error) throw new Error(error.message)
    })

    copiedFiles += 1
    copiedBytes += blob.size
    totalBytes += blob.size
    console.log(`Copied ${bucketId}/${file.fullPath} (${blob.size} bytes)`)
  })
}

if (dryRun) {
  console.log(`Dry run complete: ${totalFiles} source file(s) found.`)
} else {
  console.log(`Storage copy complete: ${copiedFiles}/${totalFiles} file(s), ${copiedBytes} bytes uploaded.`)
}
