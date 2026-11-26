// Validates migrations + RLS on an in-process Postgres (PGlite). Run: npm run test:rls
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const db = new PGlite();
await db.exec(`create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
create role authenticated;`);
await db.exec(fs.readFileSync('supabase/migrations/0001_phase1_core.sql','utf8'));
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated; grant execute on function auth.uid() to authenticated;`);
const u1 = (await db.query(`insert into auth.users(email) values ('a@x.com') returning id`)).rows[0].id;
const u2 = (await db.query(`insert into auth.users(email) values ('b@x.com') returning id`)).rows[0].id;
await db.exec(`set request.uid='${u1}'; set role authenticated;`);
const r = (await db.query(`insert into rounds(owner_id,side) values ('${u1}','pro') returning id`)).rows[0].id;
console.log('owner sees', (await db.query(`select count(*) c from rounds`)).rows[0].c, 'members', (await db.query(`select count(*) c from round_members`)).rows[0].c);
await db.exec(`reset role; set request.uid='${u2}'; set role authenticated;`);
console.log('stranger sees rounds', (await db.query(`select count(*) c from rounds`)).rows[0].c);
let blocked=false; try { await db.query(`insert into speeches(round_id,position,name,side) values ('${r}',0,'x','pro')`);} catch(e){blocked=true}
console.log('stranger insert blocked', blocked);
await db.exec(`reset role; insert into round_members(round_id,user_id,role) values ('${r}','${u2}','viewer'); set request.uid='${u2}'; set role authenticated;`);
console.log('viewer sees', (await db.query(`select count(*) c from rounds`)).rows[0].c);
blocked=false; try { await db.query(`insert into speeches(round_id,position,name,side) values ('${r}',0,'x','pro')`);} catch(e){blocked=true}
console.log('viewer insert blocked', blocked);
