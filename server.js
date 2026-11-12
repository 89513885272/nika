require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = (sql, params) => pool.query(sql, params).then(r => r.rows);
const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(session({ secret: process.env.SESSION_SECRET || 'dev', resave: false, saveUninitialized: false }));
app.use((req, res, next) => {
  res.locals.isAdmin = !!req.session.admin;
  res.locals.DAYS = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  res.locals.fmtDate = d => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  next();
});

/* ---------- Публичная часть ---------- */
const withAch = async (table, fk) => {
  const [people, ach] = await Promise.all([
    q(`SELECT * FROM ${table} ORDER BY full_name`),
    q(`SELECT * FROM achievements WHERE ${fk} IS NOT NULL ORDER BY year DESC NULLS LAST`)
  ]);
  return people.map(p => ({ ...p, ach: ach.filter(a => a[fk] === p.id) }));
};

app.get('/', async (req, res) => {
  const news = await q('SELECT * FROM news ORDER BY created_at DESC LIMIT 3');
  res.render('index', { title: 'Главная', news });
});
app.get('/schedule', async (req, res) => {
  const classes = await q(`SELECT c.*, t.full_name AS trainer FROM classes c
    LEFT JOIN trainers t ON t.id = c.trainer_id ORDER BY day_of_week, start_time`);
  res.render('schedule', { title: 'Расписание', classes });
});
app.get('/trainers', async (req, res) =>
  res.render('people', { title: 'Тренеры', heading: 'Наши тренеры', people: await withAch('trainers', 'trainer_id'), sub: p => p.bio }));
app.get('/athletes', async (req, res) =>
  res.render('people', { title: 'Спортсмены', heading: 'Наши спортсмены',
    people: await withAch('athletes', 'athlete_id'), sub: p => [p.category, p.birth_year && p.birth_year + ' г.р.'].filter(Boolean).join(' · ') }));
app.get('/news', async (req, res) =>
  res.render('news', { title: 'Новости', news: await q('SELECT * FROM news ORDER BY created_at DESC') }));
app.get('/news/:id(\\d+)', async (req, res) => {
  const [item] = await q('SELECT * FROM news WHERE id=$1', [req.params.id]);
  if (!item) return res.status(404).render('404', { title: 'Не найдено' });
  res.render('news_item', { title: item.title, item });
});

/* ---------- Админ-панель ---------- */
const dayOpts = [1, 2, 3, 4, 5, 6, 7].map(i => [i, ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][i]]);
// Конфиг сущностей: по нему строятся и формы, и SQL (имена только из этого конфига — безопасно)
const E = {
  news: { title: 'Новости', fields: [
    { n: 'title', l: 'Заголовок', t: 'text', req: 1 }, { n: 'body', l: 'Текст', t: 'textarea', req: 1 }, { n: 'image_url', l: 'Картинка (URL)', t: 'text' }] },
  classes: { title: 'Расписание', fields: [
    { n: 'group_name', l: 'Группа', t: 'text', req: 1 }, { n: 'day_of_week', l: 'День недели', t: 'select', options: dayOpts, req: 1 },
    { n: 'start_time', l: 'Начало', t: 'time', req: 1 }, { n: 'end_time', l: 'Конец', t: 'time', req: 1 },
    { n: 'hall', l: 'Зал', t: 'text' }, { n: 'trainer_id', l: 'Тренер', t: 'select', from: 'trainers', label: 'full_name' }] },
  trainers: { title: 'Тренеры', fields: [
    { n: 'full_name', l: 'ФИО', t: 'text', req: 1 }, { n: 'bio', l: 'О тренере', t: 'textarea' }, { n: 'photo_url', l: 'Фото (URL)', t: 'text' }] },
  athletes: { title: 'Спортсмены', fields: [
    { n: 'full_name', l: 'ФИО', t: 'text', req: 1 }, { n: 'birth_year', l: 'Год рождения', t: 'number' },
    { n: 'category', l: 'Категория / класс', t: 'text' }, { n: 'photo_url', l: 'Фото (URL)', t: 'text' }] },
  achievements: { title: 'Регалии', fields: [
    { n: 'title', l: 'Название регалии', t: 'text', req: 1 }, { n: 'year', l: 'Год', t: 'number' },
    { n: 'trainer_id', l: 'Тренер (если регалия тренера)', t: 'select', from: 'trainers', label: 'full_name' },
    { n: 'athlete_id', l: 'Спортсмен (если регалия спортсмена)', t: 'select', from: 'athletes', label: 'full_name' }] }
};

app.get('/admin/login', (req, res) => res.render('admin/login', { title: 'Вход', error: null }));
app.post('/admin/login', (req, res) => {
  const { login, password } = req.body;
  if (login === process.env.ADMIN_LOGIN && password === process.env.ADMIN_PASSWORD) {
    req.session.admin = true; return res.redirect('/admin');
  }
  res.render('admin/login', { title: 'Вход', error: 'Неверный логин или пароль' });
});
app.use('/admin', (req, res, next) => (req.session.admin ? next() : res.redirect('/admin/login')));
app.post('/admin/logout', (req, res) => req.session.destroy(() => res.redirect('/')));
app.get('/admin', (req, res) => res.render('admin/dashboard', { title: 'Админ-панель', E }));

app.param('e', (req, res, next, e) => { if (!E[e]) return res.sendStatus(404); req.e = e; req.cfg = E[e]; next(); });

const withOptions = fields => Promise.all(fields.map(async f => {
  if (f.t !== 'select') return f;
  if (f.options) return { ...f, opts: f.options };
  const rows = await q(`SELECT id, ${f.label} AS label FROM ${f.from} ORDER BY label`);
  return { ...f, opts: rows.map(r => [r.id, r.label]) };
}));
const formVals = (cfg, body) => cfg.fields.map(f => (body[f.n] === '' || body[f.n] === undefined ? null : body[f.n]));

app.get('/admin/:e', async (req, res) => {
  const rows = await q(`SELECT * FROM ${req.e} ORDER BY id DESC`);
  res.render('admin/list', { title: req.cfg.title, e: req.e, cfg: req.cfg, rows });
});
app.get('/admin/:e/new', async (req, res) =>
  res.render('admin/form', { title: 'Добавить', e: req.e, cfg: req.cfg, fields: await withOptions(req.cfg.fields), row: {}, action: `/admin/${req.e}` }));
app.post('/admin/:e', async (req, res) => {
  const cols = req.cfg.fields.map(f => f.n);
  await q(`INSERT INTO ${req.e} (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')})`, formVals(req.cfg, req.body));
  res.redirect(`/admin/${req.e}`);
});
app.get('/admin/:e/:id/edit', async (req, res) => {
  const [row] = await q(`SELECT * FROM ${req.e} WHERE id=$1`, [req.params.id]);
  if (!row) return res.sendStatus(404);
  res.render('admin/form', { title: 'Редактировать', e: req.e, cfg: req.cfg, fields: await withOptions(req.cfg.fields), row, action: `/admin/${req.e}/${row.id}` });
});
app.post('/admin/:e/:id', async (req, res) => {
  const cols = req.cfg.fields.map(f => f.n);
  await q(`UPDATE ${req.e} SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(',')} WHERE id=$${cols.length + 1}`,
    [...formVals(req.cfg, req.body), req.params.id]);
  res.redirect(`/admin/${req.e}`);
});
app.post('/admin/:e/:id/delete', async (req, res) => {
  await q(`DELETE FROM ${req.e} WHERE id=$1`, [req.params.id]);
  res.redirect(`/admin/${req.e}`);
});

app.use((req, res) => res.status(404).render('404', { title: 'Не найдено' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).send('Ошибка сервера: ' + err.message); });

app.listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
