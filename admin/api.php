<?php
/* Back-office Speed Festival — API JSON (toutes les actions demandent une session ouverte) */
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out($data, int $code = 200): void { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail(string $msg, int $code = 400): void { out(['erreur' => $msg], $code); }

ensure_dirs();
start_session();
$user = current_user();
if (!$user) fail('Session expirée : reconnecte-toi.', 401);

$a = $_GET['a'] ?? '';
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
if ($isPost && !csrf_ok($_SERVER['HTTP_X_CSRF'] ?? null)) fail('Jeton de sécurité invalide : recharge la page.', 403);
$body = [];
if ($isPost && strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') === 0) {
    $raw = file_get_contents('php://input', false, null, 0, 2000000);
    $body = json_decode((string) $raw, true);
    if (!is_array($body)) fail('Requête illisible.');
}

function medias(): array {
    $list = [];
    foreach (['assets/img', 'assets/img/uploads'] as $dir) {
        foreach (glob(SITE_ROOT . '/' . $dir . '/*.{jpg,jpeg,png,webp,gif,JPG,JPEG,PNG,WEBP}', GLOB_BRACE) ?: [] as $f) {
            $list[] = ['src' => $dir . '/' . basename($f), 'envoi' => $dir !== 'assets/img', 't' => filemtime($f), 'poids' => filesize($f)];
        }
    }
    usort($list, function ($x, $y) { return $y['t'] <=> $x['t']; });
    return $list;
}
function sauvegardes(): array {
    $l = [];
    foreach (glob(DATA_DIR . '/sauvegardes/*', GLOB_ONLYDIR) ?: [] as $d) $l[] = basename($d);
    rsort($l);
    return $l;
}
function nom_valide(string $n): string { if (!in_array($n, CONTENUS, true)) fail('Contenu inconnu.'); return $n; }

switch ($a) {
    case 'etat':
        $c = [];
        foreach (CONTENUS as $n) $c[$n] = contenu($n);
        $meta = read_json(DATA_DIR . '/publication.json', []);
        out([
            'utilisateur' => ['login' => $user['login'], 'nom' => $user['nom']],
            'csrf' => $_SESSION['csrf'],
            'contenus' => $c,
            'brouillons' => brouillons(),
            'journal' => array_slice(read_json(DATA_DIR . '/journal.json', []), 0, 15),
            'derniere_publication' => $meta['t'] ?? null,
            'medias' => medias(),
            'equipe' => array_map(function ($u) { return ['login' => $u['login'], 'nom' => $u['nom']]; }, users()),
            'sauvegardes' => sauvegardes(),
        ]);

    case 'apercu': /* le site en mode aperçu lit les brouillons */
        out(contenu(nom_valide((string) ($_GET['f'] ?? ''))));

    case 'enregistrer':
        if (!$isPost) fail('POST attendu.', 405);
        $n = nom_valide((string) ($body['nom'] ?? ''));
        $data = clean($body['data'] ?? null);
        if (!is_array($data)) fail('Contenu vide.');
        $wasDraft = is_file(draft_path($n));
        write_json(draft_path($n), $data);
        if (!$wasDraft) journal_add('a modifié', $n);
        out(['ok' => true, 'brouillons' => brouillons()]);

    case 'publier':
        if (!$isPost) fail('POST attendu.', 405);
        $b = brouillons();
        if (!$b) out(['ok' => true, 'brouillons' => []]);
        $dir = DATA_DIR . '/sauvegardes/' . date('Y-m-d_H-i-s');
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        foreach (CONTENUS as $n) if (is_file(published_path($n))) copy(published_path($n), $dir . '/' . $n . '.json');
        foreach ($b as $n) {
            write_json(published_path($n), read_json(draft_path($n), []));
            unlink(draft_path($n));
        }
        $all = sauvegardes();
        foreach (array_slice($all, 30) as $old) { array_map('unlink', glob(DATA_DIR . '/sauvegardes/' . $old . '/*') ?: []); @rmdir(DATA_DIR . '/sauvegardes/' . $old); }
        write_json(DATA_DIR . '/publication.json', ['t' => time(), 'qui' => $user['nom']]);
        journal_add('a publié', implode(', ', $b));
        out(['ok' => true, 'brouillons' => [], 'derniere_publication' => time(), 'sauvegardes' => sauvegardes()]);

    case 'annuler':
        if (!$isPost) fail('POST attendu.', 405);
        foreach (brouillons() as $n) unlink(draft_path($n));
        journal_add('a annulé les modifications non publiées');
        $c = [];
        foreach (CONTENUS as $n) $c[$n] = contenu($n);
        out(['ok' => true, 'brouillons' => [], 'contenus' => $c]);

    case 'restaurer': /* une sauvegarde redevient un brouillon, à vérifier puis publier */
        if (!$isPost) fail('POST attendu.', 405);
        $id = (string) ($body['id'] ?? '');
        if (!preg_match('/^\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d$/', $id) || !is_dir(DATA_DIR . '/sauvegardes/' . $id)) fail('Sauvegarde introuvable.');
        foreach (CONTENUS as $n) {
            $f = DATA_DIR . '/sauvegardes/' . $id . '/' . $n . '.json';
            if (is_file($f)) write_json(draft_path($n), read_json($f, []));
        }
        journal_add('a restauré la sauvegarde', $id);
        $c = [];
        foreach (CONTENUS as $n) $c[$n] = contenu($n);
        out(['ok' => true, 'brouillons' => brouillons(), 'contenus' => $c]);

    case 'envoyer': /* envoi d'image */
        if (!$isPost) fail('POST attendu.', 405);
        $f = $_FILES['fichier'] ?? null;
        if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK) fail('Envoi impossible (fichier trop lourd ?).');
        if ($f['size'] > 12 * 1024 * 1024) fail('Image trop lourde (12 Mo maximum).');
        $info = @getimagesize($f['tmp_name']);
        $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'];
        if (!$info || !isset($types[$info[2]])) fail('Format non accepté : JPG, PNG, WebP ou GIF.');
        if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);
        $ht = UPLOAD_DIR . '/.htaccess';
        if (!is_file($ht)) file_put_contents($ht, "<FilesMatch \"\\.(php\\d?|phtml|phar|cgi|pl|py|sh)$\">\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n</FilesMatch>\n");
        $base = pathinfo((string) $f['name'], PATHINFO_FILENAME);
        $base = strtr($base, ['à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'ç' => 'c', 'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ÿ' => 'y', 'œ' => 'oe', 'æ' => 'ae',
            'À' => 'a', 'Â' => 'a', 'Ç' => 'c', 'É' => 'e', 'È' => 'e', 'Ê' => 'e', 'Î' => 'i', 'Ô' => 'o', 'Ù' => 'u', 'Û' => 'u']);
        $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($base)), '-') ?: 'image';
        $name = substr($base, 0, 50) . '-' . bin2hex(random_bytes(3)) . '.' . $types[$info[2]];
        if (!move_uploaded_file($f['tmp_name'], UPLOAD_DIR . '/' . $name)) fail('Enregistrement de l’image impossible.', 500);
        journal_add('a envoyé une image', $name);
        out(['ok' => true, 'src' => 'assets/img/uploads/' . $name, 'medias' => medias()]);

    case 'supprimer_media':
        if (!$isPost) fail('POST attendu.', 405);
        $src = (string) ($body['src'] ?? '');
        if (!preg_match('#^assets/img/uploads/[a-z0-9-]+\.(jpg|png|webp|gif)$#', $src)) fail('Seules les images envoyées peuvent être supprimées.');
        if (is_file(SITE_ROOT . '/' . $src)) unlink(SITE_ROOT . '/' . $src);
        journal_add('a supprimé une image', basename($src));
        out(['ok' => true, 'medias' => medias()]);

    case 'mot_de_passe':
        if (!$isPost) fail('POST attendu.', 405);
        $new = (string) ($body['nouveau'] ?? '');
        if (!password_verify((string) ($body['actuel'] ?? ''), $user['hash'])) fail('Mot de passe actuel incorrect.');
        if (strlen($new) < 10) fail('10 caractères minimum.');
        $u = users();
        foreach ($u as &$x) if ($x['login'] === $user['login']) $x['hash'] = password_hash($new, PASSWORD_DEFAULT);
        unset($x);
        save_users($u);
        out(['ok' => true]);

    case 'equipe_ajouter':
        if (!$isPost) fail('POST attendu.', 405);
        $login = strtolower(trim((string) ($body['login'] ?? '')));
        $nom = trim((string) ($body['nom'] ?? ''));
        $pass = (string) ($body['mot_de_passe'] ?? '');
        if (!preg_match('/^[a-z0-9._-]{3,30}$/', $login)) fail('Identifiant : 3 à 30 caractères (lettres, chiffres, . _ -).');
        if ($nom === '' || strlen($nom) > 60) fail('Nom requis.');
        if (strlen($pass) < 10) fail('Mot de passe : 10 caractères minimum.');
        $u = users();
        foreach ($u as $x) if ($x['login'] === $login) fail('Cet identifiant existe déjà.');
        $u[] = ['login' => $login, 'nom' => $nom, 'hash' => password_hash($pass, PASSWORD_DEFAULT)];
        save_users($u);
        journal_add('a ajouté un membre', $nom);
        out(['ok' => true, 'equipe' => array_map(function ($x) { return ['login' => $x['login'], 'nom' => $x['nom']]; }, $u)]);

    case 'equipe_retirer':
        if (!$isPost) fail('POST attendu.', 405);
        $login = (string) ($body['login'] ?? '');
        if ($login === $user['login']) fail('Tu ne peux pas retirer ton propre compte.');
        $u = array_values(array_filter(users(), function ($x) use ($login) { return $x['login'] !== $login; }));
        save_users($u);
        journal_add('a retiré un membre', $login);
        out(['ok' => true, 'equipe' => array_map(function ($x) { return ['login' => $x['login'], 'nom' => $x['nom']]; }, $u)]);

    default:
        fail('Action inconnue.', 404);
}
