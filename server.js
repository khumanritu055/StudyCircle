const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/studycircle')
  .then(() => console.log('MongoDB connected'))
  .catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });

const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], required: true }
}));
const Note = mongoose.model('Note', new mongoose.Schema({
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  subject: { type: String, required: true, trim: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  description: { type: String, default: '' },
  fileName: { type: String, required: true },       // name stored on the server
  originalName: { type: String, required: true },   // name shown to users
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  downloads: { type: Number, default: 0 },
  ratings: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, stars: { type: Number, min: 1, max: 5 } }]
}, { timestamps: true }));

// ---------- File upload (multer) ----------
const UP = path.join(__dirname, 'uploads');
fs.mkdirSync(UP, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UP,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(8).toString('hex') + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => /\.(pdf|docx?|pptx?|txt)$/i.test(file.originalname) ? cb(null, true) : cb(new Error('Only PDF, Word, PowerPoint or text files are allowed.'))
});

const app = express();
app.use(express.json());
app.use(session({ secret: 'studycircle-secret-change-me', resave: false, saveUninitialized: false }));
app.use(express.static(__dirname));
const need = role => (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in first.' });
  if (role && req.session.user.role !== role) return res.status(403).json({ error: `Only an ${role} can do this.` });
  next();
};
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message || 'Something went wrong.' }));
const validId = id => mongoose.isValidObjectId(id);
const withRating = n => {
  const o = n.toObject ? n.toObject() : n, r = o.ratings || [];
  o.ratingCount = r.length; o.avgRating = r.length ? +(r.reduce((t, x) => t + x.stars, 0) / r.length).toFixed(1) : 0;
  return o;
};

// ---------- Auth ----------
app.post('/api/register', wrap(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !['student', 'admin'].includes(role)) throw new Error('Fill in all fields.');
  if (password.length < 6) throw new Error('Password needs at least 6 characters.');
  if (await User.findOne({ email: email.toLowerCase().trim() })) throw new Error('This email is already registered.');
  const u = await User.create({ name, email, password: bcrypt.hashSync(password, 10), role });
  req.session.user = { id: u._id, name: u.name, role: u.role };
  res.json(req.session.user);
}));
app.post('/api/login', wrap(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase().trim() });
  if (!u || !bcrypt.compareSync(req.body.password || '', u.password)) return res.status(401).json({ error: 'Wrong email or password.' });
  req.session.user = { id: u._id, name: u.name, role: u.role };
  res.json(req.session.user);
}));
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', (req, res) => res.json(req.session.user || null));

// ---------- Notes ----------
app.get('/api/notes', wrap(async (req, res) => {
  const f = { status: 'approved' };
  if (req.query.semester) f.semester = Number(req.query.semester);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (req.query.q) { const rx = new RegExp(esc(req.query.q), 'i'); f.$or = [{ title: rx }, { subject: rx }, { description: rx }]; }
  const notes = await Note.find(f).populate('uploader', 'name').sort({ createdAt: -1 });
  res.json(notes.map(withRating));
}));

app.post('/api/notes', need('student'), (req, res) => {
  upload.single('file')(req, res, async err => {
    try {
      if (err) throw new Error(err.code === 'LIMIT_FILE_SIZE' ? 'File is too big. Maximum size is 5 MB.' : err.message);
      if (!req.file) throw new Error('Choose a file to upload.');
      const { title, subject, semester, description } = req.body;
      if (!title || !subject || !(Number(semester) >= 1)) { fs.unlink(req.file.path, () => {}); throw new Error('Fill in title, subject and semester.'); }
      await Note.create({ uploader: req.session.user.id, title, subject, semester: Number(semester), description,
        fileName: req.file.filename, originalName: req.file.originalname });
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
});

app.get('/api/notes/:id/download', need(), wrap(async (req, res) => {
  if (!validId(req.params.id)) throw new Error('Invalid note.');
  const n = await Note.findById(req.params.id);
  const u = req.session.user;
  if (!n || (n.status !== 'approved' && u.role !== 'admin' && String(n.uploader) !== String(u.id))) return res.status(404).json({ error: 'Note not found.' });
  await Note.updateOne({ _id: n._id }, { $inc: { downloads: 1 } });
  res.download(path.join(UP, n.fileName), n.originalName);
}));

app.post('/api/notes/:id/rate', need('student'), wrap(async (req, res) => {
  const stars = Number(req.body.stars);
  if (!validId(req.params.id) || !(stars >= 1 && stars <= 5)) throw new Error('Choose 1 to 5 stars.');
  const n = await Note.findOne({ _id: req.params.id, status: 'approved' });
  if (!n) throw new Error('Note not found.');
  if (String(n.uploader) === String(req.session.user.id)) throw new Error('You cannot rate your own note.');
  const mine = n.ratings.find(r => String(r.user) === String(req.session.user.id));
  mine ? (mine.stars = stars) : n.ratings.push({ user: req.session.user.id, stars });   // rating again updates your rating
  await n.save();
  res.json({ ok: true });
}));

app.post('/api/notes/:id/approve', need('admin'), wrap(async (req, res) => {
  if (!validId(req.params.id)) throw new Error('Invalid note.');
  const n = await Note.findByIdAndUpdate(req.params.id, { status: 'approved' });
  n ? res.json({ ok: true }) : res.status(404).json({ error: 'Note not found.' });
}));

app.delete('/api/notes/:id', need(), wrap(async (req, res) => {
  if (!validId(req.params.id)) throw new Error('Invalid note.');
  const u = req.session.user;
  const n = await Note.findOneAndDelete(u.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, uploader: u.id });
  if (!n) return res.status(404).json({ error: 'Note not found.' });
  fs.unlink(path.join(UP, n.fileName), () => {});
  res.json({ ok: true });
}));

// ---------- Dashboard ----------
app.get('/api/dashboard', need(), wrap(async (req, res) => {
  const u = req.session.user;
  if (u.role === 'student') return res.json({ notes: (await Note.find({ uploader: u.id }).sort({ createdAt: -1 })).map(withRating) });
  res.json({
    pending: await Note.find({ status: 'pending' }).populate('uploader', 'name').sort({ createdAt: 1 }),
    totalNotes: await Note.countDocuments({ status: 'approved' }),
    totalUsers: await User.countDocuments({ role: 'student' })
  });
}));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StudyCircle running at http://localhost:${PORT}`));
