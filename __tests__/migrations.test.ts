import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS_DIR = join(
  __dirname,
  '..',
  'source',
  'core',
  'db',
  'migrations',
);

interface Journal {
  entries: { idx: number; tag: string }[];
}

/** Applies every migration in journal order, exactly as the device would. */
function migrate(): DatabaseSync {
  const journal: Journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'),
  );

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');

  for (const entry of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    const sql = readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) {
        db.exec(statement);
      }
    }
  }

  return db;
}

const names = (db: DatabaseSync, type: string): string[] =>
  db
    .prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name')
    .all(type)
    .map((row: unknown) => String((row as { name: string }).name));

describe('migrations', () => {
  it('every migration file is listed in the journal', () => {
    const journal: Journal = JSON.parse(
      readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'),
    );
    const onDisk = readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .map(file => file.replace(/\.sql$/, ''))
      .sort();

    expect(onDisk).toEqual(journal.entries.map(entry => entry.tag).sort());
  });

  it('applies cleanly from empty to head', () => {
    const db = migrate();

    expect(names(db, 'table')).toEqual(
      expect.arrayContaining([
        'app_state',
        'attachments',
        'conversations',
        'messages',
        'model_settings',
        'models',
      ]),
    );
    db.close();
  });

  it('stores image paths relative, not as an absolute uri', () => {
    const db = migrate();
    const columns = db
      .prepare('PRAGMA table_info(attachments)')
      .all()
      .map((row: unknown) => String((row as { name: string }).name));

    expect(columns).toContain('rel_path');
    expect(columns).not.toContain('uri');
    db.close();
  });

  it('keeps the model name on the message for attribution', () => {
    const db = migrate();
    const columns = db
      .prepare('PRAGMA table_info(messages)')
      .all()
      .map((row: unknown) => String((row as { name: string }).name));

    expect(columns).toContain('model_name');
    db.close();
  });
});

describe('referential integrity', () => {
  const seed = (db: DatabaseSync) => {
    db.exec(`
      INSERT INTO models(id, name, repo, filename, size_bytes, rel_path, downloaded_at)
        VALUES ('m1', 'Test', 'org/repo', 'a.gguf', 10, 'models/m1.gguf', 1);
      INSERT INTO app_state(id, selected_model_id) VALUES (1, 'm1');
      INSERT INTO conversations(id, title, model_id, created_at, updated_at)
        VALUES ('c1', 'Chat', 'm1', 1, 1);
      INSERT INTO messages(id, conversation_id, role, content, status, created_at)
        VALUES ('msg1', 'c1', 'user', 'hello world', 'sent', 1);
      INSERT INTO attachments(id, message_id, kind, rel_path)
        VALUES ('a1', 'msg1', 'image', 'attachments/a1.jpg');
      INSERT INTO model_settings(model_id, n_ctx) VALUES ('m1', 4096);
    `);
  };

  it('deleting a conversation takes its messages and attachments', () => {
    const db = migrate();
    seed(db);

    db.exec(`DELETE FROM conversations WHERE id = 'c1'`);

    expect(db.prepare('SELECT COUNT(*) c FROM messages').get()).toMatchObject({
      c: 0,
    });
    expect(
      db.prepare('SELECT COUNT(*) c FROM attachments').get(),
    ).toMatchObject({ c: 0 });
    db.close();
  });

  it('deleting a model un-pins conversations and clears the selection', () => {
    const db = migrate();
    seed(db);

    db.exec(`DELETE FROM models WHERE id = 'm1'`);

    // The fallback the chat store used to hand-roll, done by the schema.
    expect(
      db.prepare(`SELECT model_id FROM conversations WHERE id = 'c1'`).get(),
    ).toMatchObject({ model_id: null });
    expect(
      db.prepare('SELECT selected_model_id FROM app_state WHERE id = 1').get(),
    ).toMatchObject({ selected_model_id: null });
    // Overrides belong to the model and go with it.
    expect(
      db.prepare('SELECT COUNT(*) c FROM model_settings').get(),
    ).toMatchObject({ c: 0 });
    db.close();
  });

  it('keeps a deleted model name on past replies', () => {
    const db = migrate();
    seed(db);
    db.exec(`
      INSERT INTO messages(id, conversation_id, role, content, status, created_at, model_id, model_name)
        VALUES ('msg2', 'c1', 'assistant', 'hi', 'sent', 2, 'm1', 'Test');
    `);

    db.exec(`DELETE FROM models WHERE id = 'm1'`);

    expect(
      db.prepare(`SELECT model_name FROM messages WHERE id = 'msg2'`).get(),
    ).toMatchObject({ model_name: 'Test' });
    db.close();
  });

  it('refuses a second app_state row', () => {
    const db = migrate();
    seed(db);

    expect(() => db.exec('INSERT INTO app_state(id) VALUES (2)')).toThrow();
    db.close();
  });
});
