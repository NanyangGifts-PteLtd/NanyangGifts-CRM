import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [inputPath, outputPath] = process.argv.slice(2)

if (!inputPath || !outputPath) {
  throw new Error(
    'Usage: node migration-events/2026-10-13-us-to-sg/scripts/extract-supabase-application-grants.mjs <schema.sql> <output.sql>',
  )
}

const input = resolve(inputPath)
const output = resolve(outputPath)
const source = await readFile(input, 'utf8')

// pg_dump emits GRANT statements as one SQL statement per line. Keep grants
// only for application schemas; managed auth/storage customizations are
// restored separately by rehearsal-managed-schema-customizations.sql.
const grants = source
  .split(/\r?\n/)
  .filter((line) => /^GRANT\s+/i.test(line))
  .filter((line) => /"(?:public|private)"/i.test(line))

if (!grants.length) {
  throw new Error('No public/private GRANT statements were found in the supplied schema dump.')
}

const sql = [
  '-- Generated from the source schema dump. Do not edit the dump itself.',
  '-- Restores source public/private privileges only; auth/storage are excluded.',
  'begin;',
  ...grants,
  'commit;',
  '',
].join('\n')

await writeFile(output, sql, { encoding: 'utf8' })
console.log(`Wrote ${grants.length} GRANT statements to ${output}`)
