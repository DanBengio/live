<?php
declare(strict_types=1);
/**
 * API Live en PHP — même contrat que server/index.js (version Node).
 *
 * Stockage : SQLite dans api/data/live.sqlite (créé tout seul).
 * Les fichiers que les téléphones interrogent en boucle (état de la session,
 * questions du public, score personnel) sont écrits en JSON statique dans
 * data/s/<code>/ : Apache les sert sans passer par PHP (ETag → 304 si inchangé),
 * donc 300 téléphones restent légers pour un hébergement mutualisé.
 */

const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');

$ROOT = dirname(__DIR__);               // racine du site
$DB_DIR = __DIR__ . '/data';            // protégé par .htaccess
$PUB = $ROOT . '/data/s';               // JSON statiques publics

// ---------- Requête ----------

$method = $_SERVER['REQUEST_METHOD'];
$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$apiPos = strpos($uriPath, '/api/');
$path = $apiPos === false ? '' : trim(substr($uriPath, $apiPos + 5), '/');
$seg = $path === '' ? [] : array_map('rawurldecode', explode('/', $path));
$n = count($seg);
$uid = mb_substr((string)($_SERVER['HTTP_X_UID'] ?? ''), 0, 64);
$body = [];
if (in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
  $decoded = json_decode((string)file_get_contents('php://input'), true);
  if (is_array($decoded)) $body = $decoded;
}

function out($data, int $status = 200): void {
  http_response_code($status);
  echo json_encode($data, JSON_FLAGS);
  exit;
}
function fail(string $msg, int $status): void { out(['error' => $msg], $status); }
function str($v, int $max): string { return mb_substr(is_scalar($v) ? (string)$v : '', 0, $max); }
function num($v, $fallback = 0) { return is_numeric($v) ? $v + 0 : $fallback; }
function now(): int { return (int) round(microtime(true) * 1000); }

// ---------- Base de données ----------

if (!is_dir($DB_DIR)) mkdir($DB_DIR, 0775, true);
$pdo = new PDO('sqlite:' . $DB_DIR . '/live.sqlite');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('PRAGMA journal_mode=WAL');
$pdo->exec('PRAGMA busy_timeout=5000');
$pdo->exec('PRAGMA synchronous=NORMAL');
$pdo->exec('CREATE TABLE IF NOT EXISTS presentations (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, updated_at INTEGER NOT NULL, json TEXT NOT NULL)');
$pdo->exec('CREATE TABLE IF NOT EXISTS sessions (code TEXT PRIMARY KEY, host_id TEXT NOT NULL, json TEXT NOT NULL)');
$pdo->exec('CREATE TABLE IF NOT EXISTS participants (code TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, rank INTEGER, joined_at INTEGER NOT NULL, PRIMARY KEY (code, id))');
$pdo->exec('CREATE TABLE IF NOT EXISTS answers (code TEXT NOT NULL, item_id TEXT NOT NULL, pid TEXT NOT NULL, json TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (code, item_id, pid))');
$pdo->exec('CREATE TABLE IF NOT EXISTS questions (code TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, votes INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL, PRIMARY KEY (code, id))');

// ---------- Fichiers statiques pour les téléphones ----------

function writeJson(string $file, $data): void {
  $dir = dirname($file);
  if (!is_dir($dir)) mkdir($dir, 0775, true);
  $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
  file_put_contents($tmp, json_encode($data, JSON_FLAGS));
  rename($tmp, $file);
}
function publishSession(array $s): void { global $PUB; writeJson("$PUB/{$s['code']}/state.json", $s); }
function publishParticipant(string $code, array $p): void { global $PUB; writeJson("$PUB/$code/p/{$p['id']}.json", $p); }
function publishQuestions(string $code): void { global $PUB; writeJson("$PUB/$code/qa.json", loadQuestions($code)); }

// ---------- Accès aux données ----------

function loadSession(string $code): ?array {
  global $pdo;
  $st = $pdo->prepare('SELECT json FROM sessions WHERE code = ?');
  $st->execute([$code]);
  $j = $st->fetchColumn();
  return $j ? json_decode($j, true) : null;
}
function saveSession(array $s): void {
  global $pdo;
  $pdo->prepare('INSERT OR REPLACE INTO sessions (code, host_id, json) VALUES (?, ?, ?)')
      ->execute([$s['code'], $s['hostId'], json_encode($s, JSON_FLAGS)]);
  publishSession($s);
}
function rowToParticipant(array $r): array {
  return ['id' => $r['id'], 'name' => $r['name'], 'score' => (int)$r['score'],
          'rank' => $r['rank'] === null ? null : (int)$r['rank'], 'joinedAt' => (int)$r['joined_at']];
}
function loadParticipants(string $code): array {
  global $pdo;
  $st = $pdo->prepare('SELECT * FROM participants WHERE code = ? ORDER BY joined_at');
  $st->execute([$code]);
  return array_map('rowToParticipant', $st->fetchAll(PDO::FETCH_ASSOC));
}
function loadParticipant(string $code, string $pid): ?array {
  global $pdo;
  $st = $pdo->prepare('SELECT * FROM participants WHERE code = ? AND id = ?');
  $st->execute([$code, $pid]);
  $r = $st->fetch(PDO::FETCH_ASSOC);
  return $r ? rowToParticipant($r) : null;
}
function loadQuestions(string $code): array {
  global $pdo;
  $st = $pdo->prepare('SELECT json FROM questions WHERE code = ? ORDER BY votes DESC, at ASC');
  $st->execute([$code]);
  return array_map(fn($j) => json_decode($j, true), $st->fetchAll(PDO::FETCH_COLUMN));
}
function saveQuestion(string $code, array $q): void {
  global $pdo;
  $pdo->prepare('INSERT OR REPLACE INTO questions (code, id, json, votes, at) VALUES (?, ?, ?, ?, ?)')
      ->execute([$code, $q['id'], json_encode($q, JSON_FLAGS), $q['votes'], $q['at']]);
  publishQuestions($code);
}

// ---------- Routes ----------

if ($n === 1 && $seg[0] === 'info' && $method === 'GET') {
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  out([
    'name' => 'php',
    'publicUrl' => ($https ? 'https' : 'http') . '://' . $host,
    'pollMs' => 1500,
    'urls' => [
      'session' => '/data/s/{code}/state.json',
      'questions' => '/data/s/{code}/qa.json',
      'participant' => '/data/s/{code}/p/{pid}.json',
    ],
  ]);
}

// Présentations (privées à leur auteur)
if ($n >= 1 && $seg[0] === 'presentations') {
  if ($n === 1 && $method === 'GET') {
    $st = $pdo->prepare('SELECT json FROM presentations WHERE owner_id = ? ORDER BY updated_at DESC');
    $st->execute([$uid]);
    out(array_map(fn($j) => json_decode($j, true), $st->fetchAll(PDO::FETCH_COLUMN)));
  }
  if ($n === 2) {
    $id = $seg[1];
    $st = $pdo->prepare('SELECT owner_id, json FROM presentations WHERE id = ?');
    $st->execute([$id]);
    $existing = $st->fetch(PDO::FETCH_ASSOC) ?: null;
    if ($method === 'GET') {
      if (!$existing || $existing['owner_id'] !== $uid) fail('Présentation introuvable', 404);
      out(json_decode($existing['json'], true));
    }
    if ($method === 'PUT') {
      $p = $body;
      if ($uid === '' || ($p['id'] ?? '') !== $id || ($p['ownerId'] ?? '') !== $uid
          || ($existing && $existing['owner_id'] !== $uid)) fail('Refusé', 403);
      $p['title'] = str($p['title'] ?? '', 120);
      $p['items'] = is_array($p['items'] ?? null) ? $p['items'] : [];
      $p['updatedAt'] = (int) num($p['updatedAt'] ?? now(), now());
      $pdo->prepare('INSERT OR REPLACE INTO presentations (id, owner_id, updated_at, json) VALUES (?, ?, ?, ?)')
          ->execute([$id, $uid, $p['updatedAt'], json_encode($p, JSON_FLAGS)]);
      out(['ok' => true]);
    }
    if ($method === 'DELETE') {
      if ($existing && $existing['owner_id'] !== $uid) fail('Refusé', 403);
      $pdo->prepare('DELETE FROM presentations WHERE id = ?')->execute([$id]);
      out(['ok' => true]);
    }
  }
}

// Sessions
if ($n >= 1 && $seg[0] === 'sessions') {
  if ($n === 1 && $method === 'POST') {
    $s = $body;
    $code = (string)($s['code'] ?? '');
    if ($uid === '' || ($s['hostId'] ?? '') !== $uid || !preg_match('/^\d{6}$/', $code)) fail('Refusé', 403);
    if (loadSession($code)) fail('Code déjà utilisé', 409);
    saveSession($s);
    publishQuestions($code);
    out(['ok' => true]);
  }
  $code = (string)($seg[1] ?? '');
  $s = loadSession($code);
  if (!$s) fail('Session introuvable', 404);
  $isHost = $uid !== '' && $s['hostId'] === $uid;

  if ($n === 2) {
    if ($method === 'GET') out($s);
    if ($method === 'PATCH') {
      if (!$isHost) fail('Réservé à l’animateur', 403);
      $s = array_merge($s, $body, ['code' => $code, 'hostId' => $s['hostId']]);
      saveSession($s);
      out(['ok' => true]);
    }
  }

  $sub = $seg[2] ?? '';

  if ($sub === 'join' && $n === 3 && $method === 'POST') {
    $p = $body;
    if ($uid === '' || ($p['id'] ?? '') !== $uid) fail('Refusé', 403);
    if (($s['status'] ?? '') === 'ended') fail('Session terminée', 410);
    $name = trim(str($p['name'] ?? '', 30)) ?: 'Anonyme';
    if (loadParticipant($code, $uid)) {
      $pdo->prepare('UPDATE participants SET name = ? WHERE code = ? AND id = ?')->execute([$name, $code, $uid]);
    } else {
      $pdo->prepare('INSERT INTO participants (code, id, name, score, rank, joined_at) VALUES (?, ?, ?, 0, NULL, ?)')
          ->execute([$code, $uid, $name, now()]);
    }
    $me = loadParticipant($code, $uid);
    publishParticipant($code, $me);
    out($me);
  }

  if ($sub === 'participants' && $method === 'GET') {
    if ($n === 3) out(loadParticipants($code));
    if ($n === 4) {
      $p = loadParticipant($code, $seg[3]);
      if (!$p) fail('Participant introuvable', 404);
      out($p);
    }
  }

  if ($sub === 'scores' && $n === 3 && $method === 'POST') {
    if (!$isHost) fail('Réservé à l’animateur', 403);
    $pdo->beginTransaction();
    $upd = $pdo->prepare('UPDATE participants SET score = ?, rank = ? WHERE code = ? AND id = ?');
    $touched = [];
    foreach ($body as $u) {
      if (!is_array($u) || !isset($u['pid'])) continue;
      $upd->execute([(int) num($u['score'] ?? 0), isset($u['rank']) ? (int) num($u['rank']) : null, $code, (string)$u['pid']]);
      $touched[] = (string)$u['pid'];
    }
    $pdo->commit();
    foreach ($touched as $pid) {
      $p = loadParticipant($code, $pid);
      if ($p) publishParticipant($code, $p);
    }
    out(['ok' => true]);
  }

  if ($sub === 'answers' && $n === 3) {
    if ($method === 'POST') {
      $a = $body;
      if ($uid === '' || ($a['pid'] ?? '') !== $uid || empty($a['itemId']) || !is_array($a['value'] ?? null)) fail('Refusé', 403);
      $itemId = str($a['itemId'], 40);
      $value = array_map(fn($v) => is_int($v) || is_float($v) ? $v : str($v, 30), array_slice($a['value'], 0, 10));
      $rec = ['id' => "{$itemId}_{$uid}", 'pid' => $uid, 'name' => str($a['name'] ?? '', 30), 'itemId' => $itemId,
              'value' => $value, 'at' => now(), 'elapsedMs' => max(0, (int) num($a['elapsedMs'] ?? 0))];
      try {
        $pdo->prepare('INSERT INTO answers (code, item_id, pid, json, at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$code, $itemId, $uid, json_encode($rec, JSON_FLAGS), $rec['at']]);
      } catch (PDOException $e) {
        fail('Déjà répondu', 409);
      }
      out(['ok' => true]);
    }
    if ($method === 'GET') {
      $st = $pdo->prepare('SELECT json FROM answers WHERE code = ? AND item_id = ? ORDER BY at');
      $st->execute([$code, (string)($_GET['item'] ?? '')]);
      out(array_map(fn($j) => json_decode($j, true), $st->fetchAll(PDO::FETCH_COLUMN)));
    }
  }

  if ($sub === 'questions') {
    if ($n === 3 && $method === 'GET') out(loadQuestions($code));
    if ($n === 3 && $method === 'POST') {
      $q = $body;
      $text = trim(str($q['text'] ?? '', 280));
      if ($uid === '' || ($q['pid'] ?? '') !== $uid || $text === '' || empty($q['id'])) fail('Refusé', 403);
      saveQuestion($code, ['id' => str($q['id'], 40), 'pid' => $uid, 'name' => str($q['name'] ?? '', 30), 'text' => $text,
                           'votes' => 0, 'voters' => [], 'answered' => false, 'hidden' => false, 'at' => now()]);
      out(['ok' => true]);
    }
    if ($n >= 4) {
      $qid = $seg[3];
      $st = $pdo->prepare('SELECT json FROM questions WHERE code = ? AND id = ?');
      $st->execute([$code, $qid]);
      $j = $st->fetchColumn();
      if (!$j) fail('Question introuvable', 404);
      $q = json_decode($j, true);
      if ($n === 5 && $seg[4] === 'vote' && $method === 'POST') {
        if ($uid === '') fail('Refusé', 403);
        $q['voters'] = in_array($uid, $q['voters'], true)
          ? array_values(array_filter($q['voters'], fn($v) => $v !== $uid))
          : [...$q['voters'], $uid];
        $q['votes'] = count($q['voters']);
        saveQuestion($code, $q);
        out(['ok' => true]);
      }
      if ($n === 4 && $method === 'PATCH') {
        if (!$isHost) fail('Réservé à l’animateur', 403);
        if (is_bool($body['answered'] ?? null)) $q['answered'] = $body['answered'];
        if (is_bool($body['hidden'] ?? null)) $q['hidden'] = $body['hidden'];
        saveQuestion($code, $q);
        out(['ok' => true]);
      }
    }
  }
}

fail('Route inconnue', 404);
