require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const db = new Database(path.join(__dirname, 'rice-rush.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    items_json TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(session({
  name: 'riceRush.sid',
  secret: process.env.SESSION_SECRET || 'change-this-secret-before-deploying-rice-rush',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 1000 * 60 * 60 * 24 },
}));
app.use(express.static(__dirname));

const MENU = {
  'Karee Raitsu': 24000,
  'Bulgogi Bowl': 26000,
  'Kimchi Fried Rice': 60000,
  'Crispy Sambal Matah': 30000,
};
const publicUser = user => ({ id: user.id, name: user.name, email: user.email });
const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Silakan Sign In terlebih dahulu.' });
  next();
};

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Rice Rush API' }));
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.session.userId);
  if (!user) { req.session.destroy(() => {}); return res.json({ user: null }); }
  res.json({ user: publicUser(user) });
});
app.post('/api/auth/signup', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Nama harus terdiri dari 2–80 karakter.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Format email tidak valid.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password harus 8–128 karakter.' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, hash);
    req.session.userId = Number(result.lastInsertRowid);
    res.status(201).json({ message: 'Akun berhasil dibuat.', user: { id: Number(result.lastInsertRowid), name, email } });
  } catch (error) {
    if (String(error.code).includes('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'Email sudah terdaftar. Silakan Sign In.' });
    console.error(error); res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});
app.post('/api/auth/signin', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Email atau password salah.' });
  req.session.userId = user.id;
  res.json({ message: 'Berhasil masuk.', user: publicUser(user) });
});
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Gagal keluar dari akun.' });
    res.clearCookie('riceRush.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
    res.json({ message: 'Berhasil keluar.' });
  });
});

app.post('/api/orders', requireAuth, (req, res) => {
  const incoming = req.body.items;
  if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 30) return res.status(400).json({ error: 'Keranjang kosong atau jumlah item tidak valid.' });
  const items = [];
  for (const row of incoming) {
    const name = String(row.name || '');
    const quantity = Number(row.quantity);
    if (!(name in MENU) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) return res.status(400).json({ error: 'Ada item atau jumlah pesanan yang tidak valid.' });
    const found = items.find(item => item.name === name);
    if (found) found.quantity += quantity;
    else items.push({ name, price: MENU[name], quantity });
  }
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (total > 10000000) return res.status(400).json({ error: 'Total pesanan terlalu besar.' });
  const result = db.prepare('INSERT INTO orders (user_id, items_json, total) VALUES (?, ?, ?)').run(req.session.userId, JSON.stringify(items), total);
  res.status(201).json({ message: 'Pesanan berhasil disimpan. Pembayaran belum diproses.', order: { id: Number(result.lastInsertRowid), items, total, status: 'received' } });
});
app.get('/api/orders/mine', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT id, items_json, total, status, created_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.session.userId)
    .map(order => ({ id: order.id, items: JSON.parse(order.items_json), total: order.total, status: order.status, createdAt: order.created_at }));
  res.json({ orders });
});
app.post('/api/contact', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const message = String(req.body.message || '').trim();
  if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 3 || message.length > 3000) {
    return res.status(400).json({ error: 'Periksa kembali nama, email, dan pesan kamu.' });
  }
  const result = db.prepare('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)').run(name, email, message);
  res.status(201).json({ message: 'Pesan berhasil disimpan. Tim Rice Rush dapat menindaklanjutinya dari database.', id: Number(result.lastInsertRowid) });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.listen(PORT, () => console.log(`Rice Rush berjalan di http://localhost:${PORT}`));
