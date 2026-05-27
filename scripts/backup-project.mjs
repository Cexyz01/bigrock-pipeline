#!/usr/bin/env node
// Per-project backup. Dumps all rows tied to a given project_id across all
// related tables (direct + indirect via task/shot/asset/wip_update).
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/backup-project.mjs <project_id> [label]
//
// Output: backups/project_<label>_<timestamp>/

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_REF = 'qdxpkjgwdgxyszclxykf';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_ID = process.argv[2];
const LABEL = (process.argv[3] || 'project').replace(/[^a-zA-Z0-9_-]/g, '_');

if (!TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN env var.');
  process.exit(1);
}
if (!PROJECT_ID) {
  console.error('Usage: node scripts/backup-project.mjs <project_id> [label]');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runSql(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

const PID = `'${PROJECT_ID}'::uuid`;

// table => SELECT statement that returns the rows belonging to this project.
const QUERIES = {
  'projects':            `SELECT * FROM public.projects WHERE id = ${PID};`,
  'project_members':     `SELECT * FROM public.project_members WHERE project_id = ${PID};`,
  'project_pauses':      `SELECT * FROM public.project_pauses WHERE project_id = ${PID};`,
  'assets':              `SELECT * FROM public.assets WHERE project_id = ${PID};`,
  'shots':               `SELECT * FROM public.shots WHERE project_id = ${PID};`,
  'tasks':               `SELECT * FROM public.tasks WHERE project_id = ${PID};`,
  'gantt_lanes':         `SELECT * FROM public.gantt_lanes WHERE project_id = ${PID};`,
  'gantt_items':         `SELECT * FROM public.gantt_items WHERE project_id = ${PID};`,
  'calendar_events':     `SELECT * FROM public.calendar_events WHERE project_id = ${PID};`,
  'chat_messages':       `SELECT * FROM public.chat_messages WHERE project_id = ${PID};`,
  'notifications':       `SELECT * FROM public.notifications WHERE project_id = ${PID};`,
  'storyboard_stickers': `SELECT * FROM public.storyboard_stickers WHERE project_id = ${PID};`,

  // indirect via task_id
  'task_assignees':      `SELECT ta.* FROM public.task_assignees ta JOIN public.tasks t ON t.id = ta.task_id WHERE t.project_id = ${PID};`,
  'task_wip_updates':    `SELECT u.*  FROM public.task_wip_updates u JOIN public.tasks t ON t.id = u.task_id  WHERE t.project_id = ${PID};`,
  'task_wip_views':      `SELECT v.*  FROM public.task_wip_views v  JOIN public.tasks t ON t.id = v.task_id  WHERE t.project_id = ${PID};`,
  'comments':            `SELECT c.*  FROM public.comments c        JOIN public.tasks t ON t.id = c.task_id  WHERE t.project_id = ${PID};`,

  // wip_comments live under task_wip_updates
  'wip_comments':        `SELECT wc.* FROM public.wip_comments wc
                          JOIN public.task_wip_updates u ON u.id = wc.wip_update_id
                          JOIN public.tasks t ON t.id = u.task_id
                          WHERE t.project_id = ${PID};`,

  // miro tables — match any of shot/task/asset belonging to this project
  'miro_shot_rows':      `SELECT m.*  FROM public.miro_shot_rows m
                          JOIN public.shots s ON s.id = m.shot_id
                          WHERE s.project_id = ${PID};`,
  'miro_wip_images':     `SELECT m.* FROM public.miro_wip_images m
                          WHERE (m.shot_id  IS NOT NULL AND m.shot_id  IN (SELECT id FROM public.shots  WHERE project_id = ${PID}))
                             OR (m.task_id  IS NOT NULL AND m.task_id  IN (SELECT id FROM public.tasks  WHERE project_id = ${PID}))
                             OR (m.asset_id IS NOT NULL AND m.asset_id IN (SELECT id FROM public.assets WHERE project_id = ${PID}));`,
};

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function main() {
  const stamp = ts();
  const outDir = join('backups', `project_${LABEL}_${stamp}`);
  await mkdir(outDir, { recursive: true });

  console.log(`Backing up project ${PROJECT_ID} (${LABEL}) → ${outDir}`);

  const manifest = {
    created_at: new Date().toISOString(),
    project_ref: PROJECT_REF,
    project_id: PROJECT_ID,
    label: LABEL,
    tables: {},
  };

  for (const [name, sql] of Object.entries(QUERIES)) {
    process.stdout.write(`  ${name} ... `);
    const rows = await runSql(sql);
    await writeFile(
      join(outDir, `${name}.json`),
      JSON.stringify(rows, null, 2),
      'utf8'
    );
    manifest.tables[name] = rows.length;
    console.log(`${rows.length} rows`);
  }

  await writeFile(
    join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  const total = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
  console.log(`\nDone. Total rows: ${total}`);
  console.log(`Output: ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
