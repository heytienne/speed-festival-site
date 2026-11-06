<?php
/* Back-office Speed Festival — fonctions communes (PHP 7.4+ , sans base de données) */
declare(strict_types=1);

define('SITE_ROOT', dirname(__DIR__));
define('DATA_DIR', __DIR__ . '/data');
define('UPLOAD_DIR', SITE_ROOT . '/assets/img/uploads');
define('CONTENUS', ['general', 'accueil', 'programmation', 'billetterie', 'infos', 'replay', 'partenaires']);

/* ---------- Fichiers ---------- */
function ensure_dirs(): void {
    foreach ([DATA_DIR, DATA_DIR . '/brouillons', DATA_DIR . '/sauvegardes'] as $d) {
        if (!is_dir($d)) mkdir($d, 0755, true);
    }
    $ht = DATA_DIR . '/.htaccess';
    if (!is_file($ht)) file_put_contents($ht, "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    if (!is_file(DATA_DIR . '/index.html')) file_put_contents(DATA_DIR . '/index.html', '');
}
function read_json(string $path, $default = null) {
    if (!is_file($path)) return $default;
    $raw = (string) file_get_contents($path);
    if (substr($raw, 0, 5) === '<?php') $raw = substr($raw, (int) strpos($raw, "\n") + 1); /* fichiers protégés */
    $v = json_decode($raw, true);
    return $v === null ? $default : $v;
}
function write_json(string $path, $data, bool $protect = false): void {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) throw new RuntimeException('Encodage JSON impossible');
    if ($protect) $json = "<?php http_response_code(404); exit; ?>\n" . $json;
    $tmp = $path . '.tmp' . bin2hex(random_bytes(3));
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) throw new RuntimeException('Écriture impossible : ' . basename($path));
    if (!rename($tmp, $path)) { @unlink($tmp); throw new RuntimeException('Écriture impossible : ' . basename($path)); }
}
function published_path(string $nom): string { return SITE_ROOT . '/content/' . $nom . '.json'; }
function draft_path(string $nom): string { return DATA_DIR . '/brouillons/' . $nom . '.json'; }
function contenu(string $nom) {
    $d = read_json(draft_path($nom));
    return $d !== null ? $d : read_json(published_path($nom), []);
}
function brouillons(): array {
    return array_values(array_filter(CONTENUS, function ($n) { return is_file(draft_path($n)); }));
}

/* ---------- Nettoyage des données reçues ---------- */
function clean($v, int $depth = 0) {
    if ($depth > 8) return null;
    if (is_array($v)) {
        if (!$v) return [];
        $out = [];
        $isList = array_keys($v) === range(0, count($v) - 1);
        foreach ($v as $k => $item) {
            if (!$isList && !preg_match('/^[A-Za-z0-9_-]{1,40}$/', (string) $k)) continue;
            $c = clean($item, $depth + 1);
            if ($isList) $out[] = $c; else $out[$k] = $c;
        }
        return $out;
    }
    if (is_string($v)) {
        $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
        if ($v === null) return '';
        return substr(trim($v), 0, 20000);
    }
    if (is_bool($v) || is_int($v) || is_float($v) || $v === null) return $v;
    return null;
}

/* ---------- Session, utilisateurs, sécurité ---------- */
function is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}
function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    /* Un cookie propre à chaque installation (ex. /admin/ et /test-backoffice/admin/ ne partagent pas la connexion) */
    $path = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/admin/x')), '/') . '/';
    session_name('speed_bo_' . substr(hash('sha256', __DIR__), 0, 8));
    if (!is_dir(DATA_DIR . '/sessions')) mkdir(DATA_DIR . '/sessions', 0700, true);
    session_save_path(DATA_DIR . '/sessions'); /* sessions rangées avec les données privées de cette installation */
    ini_set('session.gc_probability', '1');
    ini_set('session.gc_divisor', '100');
    ini_set('session.gc_maxlifetime', '28800');
    session_set_cookie_params(['lifetime' => 0, 'path' => $path, 'httponly' => true, 'samesite' => 'Strict', 'secure' => is_https()]);
    session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
}
function users(): array { return read_json(DATA_DIR . '/utilisateurs.php', []); }
function save_users(array $u): void { write_json(DATA_DIR . '/utilisateurs.php', array_values($u), true); }
function current_user(): ?array {
    if (empty($_SESSION['login'])) return null;
    foreach (users() as $u) if ($u['login'] === $_SESSION['login']) return $u;
    return null;
}
function csrf_ok(?string $t): bool { return is_string($t) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $t); }

/* Anti force brute : 5 essais ratés = 15 minutes de blocage par adresse IP */
function throttle_key(): string { return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . 'speed'); }
function throttle_blocked(): int {
    $t = read_json(DATA_DIR . '/essais.php', []);
    $e = $t[throttle_key()] ?? null;
    return ($e && ($e['jusqua'] ?? 0) > time()) ? (int) ceil(($e['jusqua'] - time()) / 60) : 0;
}
function throttle_fail(): void {
    $t = read_json(DATA_DIR . '/essais.php', []);
    $k = throttle_key();
    $e = $t[$k] ?? ['n' => 0, 'jusqua' => 0];
    $e['n']++;
    if ($e['n'] >= 5) { $e = ['n' => 0, 'jusqua' => time() + 900]; }
    $t[$k] = $e;
    foreach ($t as $kk => $ee) if (($ee['jusqua'] ?? 0) < time() - 86400 && ($ee['n'] ?? 0) === 0) unset($t[$kk]);
    write_json(DATA_DIR . '/essais.php', $t, true);
}
function throttle_reset(): void {
    $t = read_json(DATA_DIR . '/essais.php', []);
    unset($t[throttle_key()]);
    write_json(DATA_DIR . '/essais.php', $t, true);
}

/* ---------- Journal des modifications ---------- */
function journal_add(string $action, string $detail = ''): void {
    $u = current_user();
    $j = read_json(DATA_DIR . '/journal.json', []);
    array_unshift($j, ['t' => time(), 'qui' => $u['nom'] ?? '?', 'action' => $action, 'detail' => $detail]);
    write_json(DATA_DIR . '/journal.json', array_slice($j, 0, 60));
}

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
