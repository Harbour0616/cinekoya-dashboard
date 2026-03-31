import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'

const supabase = createClient(
  'https://oasbhmxgblwsajrnpsgp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hc2JobXhnYmx3c2Fqcm5wc2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjM2MjYsImV4cCI6MjA5MDQ5OTYyNn0.HqEPYO13mq0uAteDbEueIFXtxBuJAOPeEAE_106ruKI'
)

// Excelファイルを読み込む
const buf = readFileSync('scripts/作品登録.xlsx')
const workbook = XLSX.read(buf, { type: 'buffer' })
const sheet = workbook.Sheets['作品別分析']
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

// データ整形（グループ引き継ぎなし）
const records = []
const toDate = (v) => {
  if (!v) return null
  if (typeof v === 'number') {
    const epoch = new Date(1899, 11, 30)
    const d = new Date(epoch.getTime() + v * 86400000)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  if (typeof v === 'string') {
    const match = v.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
    if (match) return `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`
  }
  return null
}
for (const row of rows.slice(1)) {
  const title = row[1]
  if (!title) continue
  records.push({
    title,
    group_name: row[0] || null,
    start_date: toDate(row[3]),
    end_date: toDate(row[4]),
  })
}

console.log(`パース完了: ${records.length}件`)
console.log('先頭3件:', records.slice(0, 3))

// moviesテーブルを一旦クリアして全件insert
const { error: delError } = await supabase.from('movies').delete().neq('id', 0)
if (delError) {
  console.error('削除エラー:', delError)
  process.exit(1)
}

const { error } = await supabase.from('movies').insert(records)
if (error) console.error('登録エラー:', error)
else console.log(`${records.length}件登録完了`)
