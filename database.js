import sqlite3 from 'sqlite3';
const { verbose } = sqlite3;
const db = new (verbose().Database)(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT)");
});

export default db;
