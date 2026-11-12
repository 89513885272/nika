DROP TABLE IF EXISTS achievements, classes, news, athletes, trainers CASCADE;

CREATE TABLE trainers (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT
);

CREATE TABLE athletes (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  birth_year INT,
  category TEXT,
  photo_url TEXT
);

CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  group_name TEXT NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  hall TEXT,
  trainer_id INT REFERENCES trainers(id) ON DELETE SET NULL
);

-- регалии: принадлежат либо тренеру, либо спортсмену
CREATE TABLE achievements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  year INT,
  trainer_id INT REFERENCES trainers(id) ON DELETE CASCADE,
  athlete_id INT REFERENCES athletes(id) ON DELETE CASCADE,
  CHECK (trainer_id IS NOT NULL OR athlete_id IS NOT NULL)
);

CREATE TABLE news (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO trainers (full_name, bio) VALUES
 ('Иванова Мария Сергеевна', 'Тренер высшей категории, стаж 15 лет. Специализация: европейская программа.'),
 ('Петров Алексей Николаевич', 'Мастер спорта, судья всероссийской категории. Специализация: латиноамериканская программа.');
INSERT INTO athletes (full_name, birth_year, category) VALUES
 ('Смирнов Дмитрий', 2008, 'Юниоры 2, класс C'),
 ('Кузнецова Анна', 2009, 'Юниоры 2, класс C');
INSERT INTO classes (group_name, day_of_week, start_time, end_time, hall, trainer_id) VALUES
 ('Начинающие (дети 6–9)', 1, '17:00', '18:00', 'Зал 1', 1),
 ('Юниоры, класс D–C', 3, '18:30', '20:00', 'Зал 2', 2),
 ('Взрослые, латина', 5, '19:00', '20:30', 'Зал 1', 2);
INSERT INTO achievements (title, year, trainer_id) VALUES
 ('Заслуженный тренер России', 2019, 1),
 ('Мастер спорта по танцевальному спорту', 2012, 2);
INSERT INTO achievements (title, year, athlete_id) VALUES
 ('1 место, Кубок города, Ю2 класс D', 2024, 1),
 ('Финалисты первенства области', 2025, 2);
INSERT INTO news (title, body) VALUES
 ('Открыт набор в новые группы', 'Приглашаем детей и взрослых на пробные занятия. Первое занятие — бесплатно.');
