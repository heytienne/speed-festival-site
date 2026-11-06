<?php
/* Back-office Speed Festival — connexion, création du premier compte, et page de l'application */
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

ensure_dirs();
start_session();

$erreur = '';
$installation = count(users()) === 0;
$action = $_POST['action'] ?? '';

if (($_GET['sortie'] ?? '') === '1' && csrf_ok($_GET['t'] ?? null)) {
    $_SESSION = [];
    session_destroy();
    header('Location: ./');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok($_POST['csrf'] ?? null)) {
        $erreur = 'La page a expiré, réessaie.';
    } elseif ($action === 'installer' && $installation) {
        $login = strtolower(trim((string) ($_POST['login'] ?? '')));
        $nom = trim((string) ($_POST['nom'] ?? ''));
        $pass = (string) ($_POST['mot_de_passe'] ?? '');
        if (!preg_match('/^[a-z0-9._-]{3,30}$/', $login)) $erreur = 'Identifiant : 3 à 30 caractères (lettres, chiffres, . _ -).';
        elseif ($nom === '') $erreur = 'Indique ton nom.';
        elseif (strlen($pass) < 10) $erreur = 'Mot de passe : 10 caractères minimum.';
        elseif ($pass !== ($_POST['confirmation'] ?? '')) $erreur = 'Les deux mots de passe ne correspondent pas.';
        else {
            save_users([['login' => $login, 'nom' => $nom, 'hash' => password_hash($pass, PASSWORD_DEFAULT)]]);
            session_regenerate_id(true);
            $_SESSION['login'] = $login;
            journal_add('a créé le back-office');
            header('Location: ./');
            exit;
        }
    } elseif ($action === 'connexion' && !$installation) {
        $bloque = throttle_blocked();
        if ($bloque) {
            $erreur = 'Trop d’essais. Réessaie dans ' . $bloque . ' min.';
        } else {
            $login = strtolower(trim((string) ($_POST['login'] ?? '')));
            $ok = null;
            foreach (users() as $u) if ($u['login'] === $login) $ok = $u;
            if ($ok && password_verify((string) ($_POST['mot_de_passe'] ?? ''), $ok['hash'])) {
                throttle_reset();
                session_regenerate_id(true);
                $_SESSION['login'] = $ok['login'];
                header('Location: ./');
                exit;
            }
            throttle_fail();
            $erreur = 'Identifiant ou mot de passe incorrect.';
        }
    }
}

$user = current_user();
?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Back-office — Speed Festival</title>
<link rel="icon" href="../assets/img/s-orange.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Barlow+Condensed:ital,wght@1,800;1,900&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/admin.css?v=2">
</head>
<body>
<?php if (!$user): ?>
  <main class="login">
    <form method="post" class="card login-card" autocomplete="on">
      <img src="../assets/img/logo-orange.png" alt="Speed Festival" class="login-logo">
      <h1><?= $installation ? 'Créer le compte administrateur' : 'Back-office' ?></h1>
      <p class="muted"><?= $installation ? 'Première ouverture : choisis ton identifiant et ton mot de passe. Tu pourras ajouter d’autres membres ensuite.' : 'Connecte-toi pour modifier le site.' ?></p>
      <?php if ($erreur): ?><p class="alert" role="alert"><?= h($erreur) ?></p><?php endif; ?>
      <input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>">
      <input type="hidden" name="action" value="<?= $installation ? 'installer' : 'connexion' ?>">
      <?php if ($installation): ?>
        <div class="field"><label for="nom">Ton nom</label><input class="inp" id="nom" name="nom" required maxlength="60" value="<?= h((string) ($_POST['nom'] ?? '')) ?>"></div>
      <?php endif; ?>
      <div class="field"><label for="login">Identifiant</label><input class="inp" id="login" name="login" required autocomplete="username" autocapitalize="none" value="<?= h((string) ($_POST['login'] ?? '')) ?>"></div>
      <div class="field"><label for="mdp">Mot de passe</label><input class="inp" id="mdp" name="mot_de_passe" type="password" required autocomplete="<?= $installation ? 'new-password' : 'current-password' ?>" <?= $installation ? 'minlength="10"' : '' ?>></div>
      <?php if ($installation): ?>
        <div class="field"><label for="mdp2">Confirmation</label><input class="inp" id="mdp2" name="confirmation" type="password" required autocomplete="new-password" minlength="10"></div>
      <?php endif; ?>
      <button class="btn btn-dark btn-big" type="submit"><?= $installation ? 'Créer et entrer' : 'Se connecter' ?></button>
    </form>
  </main>
<?php else: ?>
  <div id="app" data-csrf="<?= h($_SESSION['csrf']) ?>" data-sortie="?sortie=1&amp;t=<?= h($_SESSION['csrf']) ?>"><p class="boot">Chargement…</p></div>
  <script src="assets/admin.js?v=2"></script>
<?php endif; ?>
</body>
</html>
