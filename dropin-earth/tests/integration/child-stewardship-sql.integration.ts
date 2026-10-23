import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {nativeChildPool,nativeChildSql} from '../fixtures/child-stewardship-postgres.js';

/** Native schema transaction contract; full application integration is a separate suite. */
test('native SQL additive migration, serialized receipt/outbox and non-destructive rollback',async()=>{
  const pool=nativeChildPool();const sql=nativeChildSql(pool);const id=randomUUID();
  try {
    await pool.query(await readFile('services/api/prisma/child-stewardship.sql','utf8'));
    await pool.query("INSERT INTO child_stewardship.sessions(id,mode,expires_at,revision) VALUES ($1,'synthetic-demo',now()+interval '1 day',0)",[id]);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM information_schema.views WHERE table_schema='child_stewardship' AND table_name IN ('evidence_ledger','contribution_ledger','entitlement_ledger','funding_ledger')")).rows[0].n,4);
    async function command(){return sql.transaction(async db=>{
      await db.query("SELECT revision FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE",[id]);
      await db.query("UPDATE child_stewardship.sessions SET revision=revision+1 WHERE id=$1",[id]);
      await db.query("INSERT INTO child_stewardship.receipts(session_id,actor_id,idempotency_key,request_digest,result,revision) VALUES ($1,'demo-child','same-intent','synthetic-digest','{}',1)",[id]);
      await db.query("INSERT INTO child_stewardship.outbox(session_id,event_id,kind,resource_id,audience) VALUES ($1,'demo-event','review_requested','demo-observation','ordinary')",[id]);
    });}
    const results=await Promise.allSettled([command(),command()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await pool.query('SELECT revision::int AS revision FROM child_stewardship.sessions WHERE id=$1',[id])).rows[0].revision,1);
    await assert.rejects(sql.transaction(async db=>{await db.query('UPDATE child_stewardship.sessions SET revision=2 WHERE id=$1',[id]);await db.query('SELECT 1/0');}));
    assert.equal((await pool.query('SELECT revision::int AS revision FROM child_stewardship.sessions WHERE id=$1',[id])).rows[0].revision,1);
    await assert.rejects(pool.query('DELETE FROM child_stewardship.receipts WHERE session_id=$1',[id]),/CHILD_HISTORY_APPEND_ONLY/);
    await assert.rejects(pool.query('DELETE FROM child_stewardship.sessions WHERE id=$1',[id]),/CHILD_HISTORY_APPEND_ONLY/);
    await pool.query(await readFile('services/api/prisma/child-stewardship.rollback.sql','utf8'));
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM child_stewardship.receipts WHERE session_id=$1',[id])).rows[0].n,1);
    // Append-only synthetic evidence remains in this disposable test database until it is destroyed.
  }finally{await pool.end();}
});
