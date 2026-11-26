// Validates migrations + RLS on an in-process Postgres (PGlite). Run: npm run test:rls
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const db = new PGlite();
await db.exec(`create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.uid', true),'')::uuid $$;
create role authenticated;`);
await db.exec(fs.readFileSync('supabase/migrations/0001_phase1_core.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/0002_phase2_5_schema.sql','utf8'));
// Stub Supabase's realtime schema so the policy SQL is at least parsed and applied.
await db.exec(`create schema realtime; create table realtime.messages(id int, extension text); create function realtime.topic() returns text language sql as $$ select current_setting('request.topic', true) $$; alter table realtime.messages enable row level security;`);
await db.exec(fs.readFileSync('supabase/migrations/0003_realtime_private_channels.sql','utf8'));
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

// ── invites, roles, teams, versions ──
const ok = async (label, fn, expect) => { let r; try { await fn(); r = true; } catch { r = false; } console.log(label, r === expect ? 'OK' : 'FAIL (got ' + r + ')'); };
await db.exec(`reset role; set request.uid='${u1}'; set role authenticated;`);
const tok = (await db.query(`insert into round_invites(round_id, role) values ('${r}','editor') returning token`)).rows[0].token;
await db.exec(`reset role; set request.uid='${u2}'; set role authenticated;`);
await ok('non-owner cannot create invite', () => db.query(`insert into round_invites(round_id, role, created_by) values ('${r}','editor','${u2}')`), false);
await db.exec(`reset role; delete from round_members where user_id='${u2}'; set request.uid='${u2}'; set role authenticated;`);
console.log('before accept sees', (await db.query(`select count(*) c from rounds`)).rows[0].c);
await db.query(`select accept_invite('${tok}')`);
console.log('after accept sees', (await db.query(`select count(*) c from rounds`)).rows[0].c);
await ok('invited editor can write speeches', () => db.query(`insert into speeches(round_id,position,name,side) values ('${r}',0,'x','pro')`), true);
await ok('editor cannot delete round', async () => { const x = await db.query(`delete from rounds where id='${r}' returning id`); if (!x.rows.length) throw new Error('none'); }, false);
await ok('bad token rejected', () => db.query(`select accept_invite('nope')`), false);
await db.exec(`reset role; update round_invites set revoked = true; set request.uid='${u2}'; set role authenticated;`);
await ok('revoked token rejected', () => db.query(`select accept_invite('${tok}')`), false);
await db.exec(`reset role;`);
const u3 = (await db.query(`insert into auth.users(email) values ('c@x.com') returning id`)).rows[0].id;
await db.exec(`set request.uid='${u3}'; set role authenticated;`);
await ok('stranger cannot read versions', async () => { const x = await db.query(`select * from round_versions where round_id='${r}'`); if (x.rows.length) throw new Error('leak'); }, true);
await db.exec(`reset role; set request.uid='${u2}'; set role authenticated;`);
await ok('editor can save a version', () => db.query(`insert into round_versions(round_id, snapshot, created_by) values ('${r}', '{}', '${u2}')`), true);
await db.exec(`reset role; set request.uid='${u1}'; set role authenticated;`);
const team = (await db.query(`insert into teams(name) values ('T') returning id`)).rows[0].id;
await db.query(`insert into evidence_cards(tag, team_id) values ('shared', '${team}')`);
await db.exec(`reset role; insert into team_memberships values ('${team}','${u2}','viewer'); set request.uid='${u2}'; set role authenticated;`);
console.log('team viewer sees card', (await db.query(`select count(*) c from evidence_cards`)).rows[0].c);
await ok('team viewer cannot edit card', async () => { const x = await db.query(`update evidence_cards set tag='x' returning id`); if (!x.rows.length) throw new Error('none'); }, false);
await db.exec(`reset role; set request.uid='${u3}'; set role authenticated;`);
console.log('non-member sees cards', (await db.query(`select count(*) c from evidence_cards`)).rows[0].c);
