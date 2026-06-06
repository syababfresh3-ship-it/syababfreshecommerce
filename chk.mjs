import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('./.env.local','utf8').split('\n')){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'')}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} })

const CSV='/Users/anas./Downloads/purchases-20260531195603.csv'
const lines = readFileSync(CSV,'utf8').split('\n').filter(l=>l.trim()); lines.shift()
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// paid rows → { ref(orderId), txnId(purchaseId) }
const paid=[]
for(const line of lines){const p=line.split(','); if(p[2]==='paid'){const ref=p[p.length-7], txn=p[0]; if(UUID.test(ref)&&UUID.test(txn)) paid.push({ref,txn})}}

const out=[]
out.push(`paid rows w/ valid uuids: ${paid.length}`)
const txnByRef=Object.fromEntries(paid.map(x=>[x.ref,x.txn]))
const refs=Object.keys(txnByRef)

let lpFixed=0, sybFixed=0
for(let i=0;i<refs.length;i+=100){
  const chunk=refs.slice(i,i+100)
  // LP orders with NULL ref
  const {data:lp}=await sb.from('lp_guest_orders').select('id,order_number,payment_ref').in('id',chunk).is('payment_ref',null)
  for(const r of lp??[]){
    const {error}=await sb.from('lp_guest_orders').update({payment_ref:txnByRef[r.id]}).eq('id',r.id).is('payment_ref',null)
    if(!error){lpFixed++; out.push(`  [LP] ${r.order_number} ← ${txnByRef[r.id]}`)} else out.push(`  [LP-ERR] ${r.order_number}: ${error.message}`)
  }
  // storefront orders with NULL ref
  const {data:od}=await sb.from('orders').select('id,order_number,payment_ref').in('id',chunk).is('payment_ref',null)
  for(const r of od??[]){
    const {error}=await sb.from('orders').update({payment_ref:txnByRef[r.id]}).eq('id',r.id).is('payment_ref',null)
    if(!error){sybFixed++; out.push(`  [SYB] ${r.order_number} ← ${txnByRef[r.id]}`)} else out.push(`  [SYB-ERR] ${r.order_number}: ${error.message}`)
  }
}
out.unshift(`=== BACKFILL payment_ref: LP ${lpFixed} + SYB ${sybFixed} = ${lpFixed+sybFixed} ===`)
writeFileSync('/tmp/chk.txt',out.join('\n')+'\n')
console.log('done')
process.exit(0)
