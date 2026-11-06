/* Back-office Speed Festival — application (sans dépendance) */
(function () {
  'use strict';

  const app = document.getElementById('app');
  const CSRF = app.dataset.csrf, SORTIE = app.dataset.sortie;
  const S = { c: {}, brouillons: [], journal: [], medias: [], equipe: [], sauvegardes: [], user: null, pub: null };
  const UI = { sel: { pages: 'tete', prog: -1, infos: 0 }, jour: 'tous', lib: false, saving: 0, savedAt: 0 };

  /* ---------- Outils ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  function set(o, p, v) {
    const ks = p.split('.'); let x = o;
    for (let i = 0; i < ks.length - 1; i++) { if (x[ks[i]] == null) x[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; x = x[ks[i]]; }
    x[ks[ks.length - 1]] = v;
  }
  const src = (p) => (p ? '../' + String(p).replace(/^\/+/, '') : '');
  const todos = (v) => (JSON.stringify(v || '').match(/\[\[/g) || []).length;
  const plural = (n, s, p) => n + ' ' + (n > 1 ? (p || s + 's') : s);
  const $ = (q) => app.querySelector(q);
  function toast(msg, err) {
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), err ? 5000 : 2600);
  }
  function quand(t) {
    if (!t) return 'jamais';
    const d = Math.floor(Date.now() / 1000 - t);
    if (d < 60) return 'à l’instant';
    if (d < 3600) return 'il y a ' + Math.floor(d / 60) + ' min';
    const dt = new Date(t * 1000), auj = new Date();
    const h = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (dt.toDateString() === auj.toDateString()) return 'aujourd’hui à ' + h;
    return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + h;
  }

  /* ---------- Serveur ---------- */
  function api(a, body, isForm) {
    const opt = { method: body ? 'POST' : 'GET', headers: { 'X-CSRF': CSRF }, credentials: 'same-origin' };
    if (body) { if (isForm) opt.body = body; else { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); } }
    return fetch('api.php?a=' + a, opt).then((r) => r.json().catch(() => ({ erreur: 'Réponse illisible du serveur (' + r.status + ')' })).then((j) => {
      if (r.status === 401) { location.reload(); throw new Error(j.erreur); }
      if (!r.ok || j.erreur) throw new Error(j.erreur || 'Erreur ' + r.status);
      return j;
    }));
  }
  const timers = {};
  function save(file) {
    clearTimeout(timers[file]);
    UI.saving++; topStatus();
    timers[file] = setTimeout(() => {
      delete timers[file];
      api('enregistrer', { nom: file, data: S.c[file] })
        .then((j) => { S.brouillons = j.brouillons; UI.savedAt = Date.now(); })
        .catch((e) => toast(e.message, true))
        .finally(() => { UI.saving = Math.max(0, UI.saving - 1); topStatus(); navCounts(); });
    }, 600);
  }
  function flush() {
    const files = Object.keys(timers);
    files.forEach((f) => clearTimeout(timers[f]));
    return Promise.all(files.map((f) => { delete timers[f]; return api('enregistrer', { nom: f, data: S.c[f] }).then((j) => { S.brouillons = j.brouillons; UI.saving = Math.max(0, UI.saving - 1); }); }));
  }
  function upload(file) {
    const fd = new FormData(); fd.append('fichier', file);
    return api('envoyer', fd, true).then((j) => { S.medias = j.medias; return j.src; });
  }

  /* ---------- Référentiels ---------- */
  const COUL = [['orange', 'Orange', '#FF5500'], ['vert', 'Vert', '#00FF97'], ['bleu', 'Bleu', '#00BFFF'], ['rose', 'Rose', '#FC8AFD'], ['jaune', 'Jaune', '#F1FF00'], ['marron', 'Marron', '#804240']];
  const FONDS = [['creme', 'Crème', '#FFF8E6'], ['orange', 'Orange', '#FF5500'], ['vert', 'Vert', '#00FF97'], ['bleu', 'Bleu', '#00BFFF'], ['rose', 'Rose', '#FC8AFD'], ['jaune', 'Jaune', '#F1FF00'], ['noir', 'Noir', '#000000']];
  const HEX = Object.fromEntries(COUL.concat(FONDS).map((c) => [c[0], c[2]]));
  const SCENES = { arena: ['Speed Arena', '#FF5500'], boiler: ['Boiler Vroom', '#00FF97'] };
  const BLOCS = {
    'compte-a-rebours': { t: 'Compte à rebours', ic: '⏱' }, programmation: { t: 'Grille de départ', ic: '🏁' }, infos: { t: 'Briefing pilotes', ic: 'ℹ' },
    replay: { t: 'Le replay', ic: '📷' }, billetterie: { t: 'Billetterie', ic: '🎟' }, benevoles: { t: 'Rejoins le stand', ic: '🙋' }, partenaires: { t: 'Partenaires', ic: '🤝' },
    'texte-libre': { t: 'Bloc texte + image', ic: '¶', libre: true, d: 'Titre, texte, image et bouton, sur le fond de ton choix.' },
    annonce: { t: 'Bandeau annonce', ic: '📣', libre: true, d: 'Un message court et voyant, avec un bouton.' }
  };
  const TPL = {
    artiste: () => ({ nom: 'Nouvel artiste', jour: UI.jour === 'sam' ? 'sam' : 'ven', scene: 'arena', debut: '20h00', fin: '21h00', photo: '', bio: '', ecoute: '', sans_ecoute: false, publie: false }),
    pass: () => ({ nom: 'Nouveau pass', prix: '', couleur: 'jaune', en_vedette: false, statut: 'bientot', bandeau: '→ ', bandeau_droite: '', lien: '' }),
    carte: () => ({ titre: 'Nouvelle carte', resume: '', photo: '', couleur: 'bleu', pictogramme: 'rond', texte_pictogramme: '?', intro: '', lignes: [], horaires: [], interdits: [], bouton_texte: '', bouton_lien: '' }),
    ligne: () => ({ titre: '', texte: '' }), horaire: () => ({ jour: '', ouverture: '', premier_depart: '', fermeture: '' }), interdit: () => '',
    photo: () => ({ image: '', description: '', format: 'normal', etiquette: '', couleur: 'orange' }), logo: () => ({ nom: '', logo: '', lien: '' }),
    'texte-libre': () => ({ type: 'texte-libre', visible: true, fond: 'creme', surtitre: '', titre: 'Nouveau bloc', texte: '', image: '', bouton_texte: '', bouton_lien: '' }),
    annonce: () => ({ type: 'annonce', visible: true, fond: 'jaune', texte: 'Ton message ici', bouton_texte: '', bouton_lien: '' })
  };

  /* ---------- Champs de formulaire (liés aux données par data-file / data-f) ---------- */
  let uid = 0;
  function inp(file, path, label, o = {}) {
    const id = 'f' + (++uid), v = get(S.c[file], path);
    const val = v == null ? '' : String(v);
    const empty = o.req && (!val || (o.pattern && !o.pattern.test(val))) ? ' empty' : '';
    const attrs = `id="${id}" class="inp${empty}" data-file="${file}" data-f="${path}"${o.req ? ' data-req="1"' : ''}${o.pattern ? ` data-pattern="${esc(o.pattern.source)}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}`;
    const field = o.area ? `<textarea ${attrs} rows="${o.rows || 4}">${esc(val)}</textarea>` : `<input ${attrs} type="${o.type || 'text'}" value="${esc(val)}">`;
    return `<div class="field">${label ? `<label for="${id}">${esc(label)}</label>` : ''}${field}${o.hint ? `<span class="hint">${o.hint}</span>` : ''}</div>`;
  }
  function sel(file, path, label, opts) {
    const id = 'f' + (++uid), v = get(S.c[file], path);
    return `<div class="field"><label for="${id}">${esc(label)}</label><select id="${id}" class="inp" data-file="${file}" data-f="${path}">${opts.map((x) => `<option value="${esc(x[0])}"${x[0] === v ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select></div>`;
  }
  function seg(file, path, label, opts) {
    const v = get(S.c[file], path);
    return `<div class="field"><span class="flabel">${esc(label)}</span><div class="seg" role="group" aria-label="${esc(label)}">${opts.map((x) =>
      `<button type="button" data-act="seg" data-file="${file}" data-f="${path}" data-v="${esc(x[0])}" class="${x[0] === v ? 'on' : ''}" aria-pressed="${x[0] === v}">${x[2] ? `<span class="color-dot" style="background:${x[2]}"></span>` : ''}${esc(x[1])}</button>`).join('')}</div></div>`;
  }
  function sw(file, path, label, dflt) {
    let v = get(S.c[file], path); if (v == null) v = !!dflt;
    return `<button type="button" class="sw-line" data-act="sw" data-file="${file}" data-f="${path}"${dflt ? ' data-dflt="1"' : ''} role="switch" aria-checked="${!!v}"><span class="sw ${v ? 'on' : ''}"></span>${esc(label)}</button>`;
  }
  function imgField(file, path, label, big) {
    const v = get(S.c[file], path);
    return `<div class="field"><span class="flabel">${esc(label)}</span>
      <div class="drop ${v ? 'has' : ''}" data-drop="1" data-file="${file}" data-f="${path}" style="${v ? `background-image:url('${esc(src(v))}');min-height:${big ? 170 : 130}px` : ''}">
        ${v ? '' : '<strong>Dépose une image ici</strong><span class="hint">ou clique pour en choisir une (JPG, PNG, WebP)</span>'}
        <div class="drop-acts">${v ? `<button type="button" class="btn btn-sm" data-act="clear" data-file="${file}" data-f="${path}">Retirer</button>` : ''}
        <button type="button" class="btn btn-sm" data-act="pick" data-file="${file}" data-f="${path}">${v ? 'Changer' : 'Bibliothèque'}</button></div>
      </div></div>`;
  }
  function tools(file, path, i, n, delLabel) {
    return `<div class="item-tools"><button type="button" class="icon-btn" data-act="up" data-file="${file}" data-path="${path}" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">↑</button>
      <button type="button" class="icon-btn" data-act="down" data-file="${file}" data-path="${path}" data-i="${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Descendre">↓</button>
      <button type="button" class="icon-btn btn-danger" data-act="del" data-file="${file}" data-path="${path}" data-i="${i}" aria-label="${esc(delLabel || 'Supprimer')}">✕</button></div>`;
  }
  const card = (title, body, right) => `<section class="card"><div class="card-h"><h2>${title}</h2>${right || ''}</div><div class="card-b">${body}</div></section>`;
  const TODO_HINT = 'Écris <b>[[à compléter]]</b> pour surligner un passage manquant sur le site.';

  /* ---------- Navigation ---------- */
  const ICO = {
    tableau: '<path d="M3 10.5 12 3l9 7.5V21H3z"></path><path d="M9 21v-6h6v6"></path>',
    pages: '<rect x="3" y="3" width="18" height="6" rx="1.5"></rect><rect x="3" y="12" width="18" height="9" rx="1.5"></rect>',
    programmation: '<path d="M9 18V5l11-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="17" cy="16" r="3"></circle>',
    billetterie: '<path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3z"></path><path d="M14 4v12"></path>',
    infos: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
    medias: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="m21 16-5-5-9 9"></path>',
    partenaires: '<path d="M12 3 4 7v6c0 4 3.4 7.4 8 8 4.6-.6 8-4 8-8V7z"></path>',
    benevoles: '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.7c1.6.8 2.7 2.6 3 5.3"></path>',
    reglages: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"></path>'
  };
  const TITRES = { tableau: 'Tableau de bord', pages: 'Pages & blocs', programmation: 'Programmation', billetterie: 'Billetterie', infos: 'Infos pratiques', medias: 'Médias', partenaires: 'Partenaires', reglages: 'Réglages' };
  function route() {
    const h = (location.hash || '#tableau').slice(1).split('/');
    return { r: TITRES[h[0]] || h[0] === 'benevoles' ? h[0] : 'tableau', arg: h[1] };
  }
  function navHtml(cur) {
    const a = (id, t, cnt, warn) => `<a href="#${id}" class="${cur === id ? 'on' : ''}"${cur === id ? ' aria-current="page"' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[id]}</svg><span class="nav-t">${t}</span>${cnt != null ? `<span class="cnt${warn ? ' warn' : ''}" data-cnt="${id}">${cnt}</span>` : ''}</a>`;
    const nArt = (S.c.programmation.artistes || []).length, nPass = (S.c.billetterie.pass || []).length, nTodo = todos(S.c.infos);
    return `<nav class="nav" aria-label="Navigation du back-office">${a('tableau', 'Tableau de bord')}<p class="lbl">Contenus</p>${a('pages', 'Pages &amp; blocs')}${a('programmation', 'Programmation', nArt)}${a('billetterie', 'Billetterie', nPass)}${a('infos', 'Infos pratiques', nTodo || null, true)}${a('medias', 'Médias')}${a('partenaires', 'Partenaires')}${a('benevoles', 'Bénévoles')}<p class="lbl">Site</p>${a('reglages', 'Réglages')}</nav>`;
  }
  function navCounts() {
    const set2 = (id, v) => { const e = app.querySelector(`[data-cnt="${id}"]`); if (e) e.textContent = v; };
    set2('programmation', (S.c.programmation.artistes || []).length); set2('billetterie', (S.c.billetterie.pass || []).length); set2('infos', todos(S.c.infos));
  }
  function topStatus() {
    const z = $('#top-status'); if (!z) return;
    const n = S.brouillons.length;
    z.innerHTML = (UI.saving ? '<span class="saving">Enregistrement…</span>' : (UI.savedAt ? '<span class="saving">Brouillon enregistré ✓</span>' : '')) +
      (n ? `<span class="pill warn"><span class="dot" style="background:#E0A100"></span>${plural(n, 'rubrique modifiée', 'rubriques modifiées')}, non ${n > 1 ? 'publiées' : 'publiée'}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-act="annuler">Annuler</button>
        <a class="btn" href="../index.html?apercu=1" target="_blank" rel="noopener">Aperçu ↗</a>`
        : '<span class="pill ok"><span class="dot" style="background:#1E9E5A"></span>Tout est publié</span>') +
      `<a class="btn" href="../" target="_blank" rel="noopener">Voir le site ↗</a><button type="button" class="btn btn-dark" data-act="publier" ${n || UI.saving ? '' : 'disabled'}>Publier</button>`;
  }

  /* ---------- Rendu général ---------- */
  function render() {
    uid = 0;
    let { r, arg } = route();
    if (r === 'benevoles') { r = 'pages'; arg = 'benevoles'; }
    const navId = route().r;
    if (r === 'pages' && arg) {
      const i = S.c.accueil.blocs.findIndex((b) => b.type === arg);
      UI.sel.pages = i >= 0 ? i : (arg === 'tete' || arg === 'pied' ? arg : UI.sel.pages);
      history.replaceState(null, '', '#pages'); /* la sélection n'est appliquée qu'une fois */
    }
    const ini = (S.user.nom || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    app.innerHTML = `<div class="app">
      <aside class="side"><div class="brand"><img src="../assets/img/logo-orange.png" alt="Speed Festival"><div><strong style="font-size:13px">Back-office</strong><small>Speed Festival</small></div></div>
        ${navHtml(navId)}
        <div class="who"><span class="av" aria-hidden="true">${esc(ini)}</span><div class="who-txt" style="line-height:1.3"><strong style="font-size:13px">${esc(S.user.nom)}</strong><br><a href="${esc(SORTIE)}">Se déconnecter</a></div></div></aside>
      <div class="main"><header class="top"><div><div class="crumb">Back-office</div><h1>${TITRES[r]}</h1></div><div class="acts" id="top-status"></div></header>
        <main class="content" id="content">${(SCREENS[r] || SCREENS.tableau)()}</main></div></div>`;
    topStatus();
    if (r === 'pages') bindDrag();
  }
  function refresh() { const y = window.scrollY; render(); window.scrollTo(0, y); }

  /* ---------- Écran : tableau de bord ---------- */
  function checklist() {
    const P = (S.c.programmation.artistes || []).filter((a) => a.publie !== false), B = S.c.billetterie, G = S.c.general;
    const dep = Date.parse((G.depart || '') + ':00+02:00');
    const passes = B.pass || [];
    const ben = (S.c.accueil.blocs || []).find((b) => b.type === 'benevoles') || {};
    return [
      { t: 'Dates de l’édition et compte à rebours', d: dep > Date.now() ? 1 : 0, n: 1, r: 'reglages', note: dep > Date.now() ? '' : 'La date du compte à rebours est passée' },
      { t: 'Photos presse des artistes', d: P.filter((a) => a.photo).length, n: P.length, r: 'programmation' },
      { t: 'Présentations des artistes', d: P.filter((a) => a.bio && !/\[\[/.test(a.bio)).length, n: P.length, r: 'programmation' },
      { t: 'Liens d’écoute (magic links)', d: P.filter((a) => a.ecoute || a.sans_ecoute).length, n: P.length, r: 'programmation' },
      { t: 'Prix des pass', d: passes.filter((p) => p.prix).length, n: passes.length, r: 'billetterie' },
      { t: 'Lien de la billetterie', d: B.lien || (passes.length && passes.every((p) => p.lien)) ? 1 : 0, n: 1, r: 'billetterie' },
      { t: 'Infos pratiques (passages à compléter)', d: todos(S.c.infos) ? 0 : 1, n: 1, r: 'infos', note: todos(S.c.infos) ? plural(todos(S.c.infos), 'passage') + ' à compléter' : '' },
      { t: 'Logos partenaires', d: Math.min((S.c.partenaires.logos || []).length, 1), n: 1, r: 'partenaires', note: (S.c.partenaires.logos || []).length ? '' : 'Aucun logo' },
      { t: 'E-mail partenariats', d: S.c.partenaires.email ? 1 : 0, n: 1, r: 'partenaires' },
      { t: 'Lien d’inscription bénévoles', d: ben.bouton_lien ? 1 : 0, n: 1, r: 'benevoles' }
    ];
  }
  const SCREENS = {};
  SCREENS.tableau = function () {
    const P = S.c.programmation.artistes || [], blocs = S.c.accueil.blocs || [];
    const list = checklist(), restant = list.filter((x) => x.d < x.n).length;
    const rows = list.map((x) => {
      const pct = x.n ? Math.round((x.d / x.n) * 100) : 100, done = x.d >= x.n;
      return `<a class="row" href="#${x.r}"><span class="chk ${done ? 'y' : 'w'}" aria-hidden="true">${done ? '✓' : '!'}</span>
        <div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><strong style="font-weight:600">${x.t}</strong><span class="muted small">${x.n > 1 ? x.d + ' / ' + x.n : (done ? 'Fait' : (x.note || 'À faire'))}</span></div>
        ${x.n > 1 ? `<div class="bar" style="margin-top:6px"><span class="${done ? 'full' : ''}" style="width:${pct}%"></span></div>` : (x.note && !done ? '' : '')}</div><span class="muted" aria-hidden="true">›</span></a>`;
    }).join('');
    const j = S.journal.length ? S.journal.map((e) => `<div class="row"><span class="ico" aria-hidden="true">${e.action.indexOf('publi') >= 0 ? '🚀' : '✎'}</span><div style="flex:1;min-width:0"><strong style="font-weight:600">${esc(e.qui)}</strong> ${esc(e.action)} <span class="muted">${esc(e.detail)}</span></div><span class="muted small">${quand(e.t)}</span></div>`).join('') : '<p class="empty-state">Aucune modification pour l’instant.</p>';
    return `<section class="card" style="display:flex;flex-wrap:wrap;align-items:center;gap:16px;padding:16px 18px">
        <span class="pill ok"><span class="dot" style="background:#1E9E5A"></span>En ligne</span><a href="../" target="_blank" rel="noopener">${esc(location.host)}</a>
        <span class="muted" style="margin-left:auto">Dernière publication : ${quand(S.pub)}</span></section>
      <section class="kpis">
        <div class="card kpi"><div class="muted small">Artistes publiés</div><b>${P.filter((a) => a.publie !== false).length}</b><div class="muted small">${plural(P.filter((a) => a.jour === 'ven').length, 'set')} vendredi · ${P.filter((a) => a.jour === 'sam').length} samedi</div></div>
        <div class="card kpi"><div class="muted small">Scènes</div><b>2</b><div class="muted small"><span class="dot" style="background:#FF5500"></span> Speed Arena · <span class="dot" style="background:#00FF97"></span> Boiler Vroom</div></div>
        <div class="card kpi"><div class="muted small">Pass en vente</div><b>${(S.c.billetterie.pass || []).filter((p) => p.statut === 'vente').length}</b><div class="muted small">sur ${(S.c.billetterie.pass || []).length} pass</div></div>
        <div class="card kpi"><div class="muted small">Blocs sur l’accueil</div><b>${blocs.filter((b) => b.visible !== false).length}</b><div class="muted small">${blocs.filter((b) => b.visible === false).length} masqué(s)</div></div>
      </section>
      <div class="cols">
        <section class="card"><div class="card-h"><h2>À compléter avant l’annonce</h2><span class="pill ${restant ? 'warn' : 'ok'}">${restant ? plural(restant, 'point') + ' restant' + (restant > 1 ? 's' : '') : 'Tout est prêt'}</span></div><div>${rows}</div></section>
        <div style="display:flex;flex-direction:column;gap:20px">
          <section class="card"><div class="card-h"><h2>Actions rapides</h2></div><div class="card-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">
            <a class="btn" href="#programmation" data-act="go-add-artist">+ Ajouter un artiste</a><a class="btn" href="#billetterie">Modifier les pass</a>
            <a class="btn" href="#pages" data-act="go-lib">+ Ajouter un bloc</a><a class="btn" href="#medias">Envoyer des photos</a></div></section>
          <section class="card"><div class="card-h"><h2>Dernières modifications</h2></div><div>${j}</div></section>
        </div></div>`;
  };

  /* ---------- Écran : pages & blocs ---------- */
  function blocName(b) { const m = BLOCS[b.type] || { t: b.type }; return m.libre ? (b.titre || b.texte || m.t) : m.t; }
  SCREENS.pages = function () {
    const blocs = S.c.accueil.blocs || [], cur = UI.sel.pages;
    const fixed = (id, t, d) => `<button type="button" class="blk fixed ${cur === id ? 'sel' : ''}" data-act="selblk" data-i="${id}"><span class="grip" aria-hidden="true">🔒</span><span class="blk-name">${t}</span><span class="btype">${d}</span></button>`;
    const list = blocs.map((b, i) => `<div class="blk ${cur === i ? 'sel' : ''} ${b.visible === false ? 'off' : ''}" draggable="true" data-i="${i}" data-act="selblk" role="button" tabindex="0">
        <span class="grip" title="Glisser pour déplacer" aria-hidden="true">⋮⋮</span><span class="blk-name">${esc(blocName(b))}</span>
        <span class="btype">${BLOCS[b.type] && BLOCS[b.type].libre ? 'Libre' : 'Section'}</span>
        <button type="button" class="icon-btn" data-act="up" data-file="accueil" data-path="blocs" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Monter ${esc(blocName(b))}">↑</button>
        <button type="button" class="icon-btn" data-act="down" data-file="accueil" data-path="blocs" data-i="${i}" ${i === blocs.length - 1 ? 'disabled' : ''} aria-label="Descendre ${esc(blocName(b))}">↓</button>
        <span class="sw ${b.visible === false ? '' : 'on'}" data-act="sw" data-file="accueil" data-f="blocs.${i}.visible" data-dflt="1" role="switch" aria-checked="${b.visible !== false}" aria-label="Afficher ${esc(blocName(b))}" tabindex="0"></span></div>`).join('');
    const present = blocs.map((b) => b.type);
    const lib = Object.keys(BLOCS).filter((k) => BLOCS[k].libre || present.indexOf(k) < 0).map((k) =>
      `<button type="button" class="libi" data-act="addblk" data-type="${k}"><span class="thumb" aria-hidden="true">${BLOCS[k].ic}</span><strong>${BLOCS[k].t}</strong><span class="hint">${BLOCS[k].d || 'Section du site, retirée de la page : la remettre.'}</span></button>`).join('');
    return `<div class="split"><div style="display:flex;flex-direction:column;gap:20px">
        <section class="card"><div class="card-h"><h2>Page d’accueil</h2><span class="muted small">Glisse les blocs pour les réordonner</span></div>
          <div class="blist" id="blist">${fixed('tete', 'Bandeau & en-tête', 'Fixe')}${list}${fixed('pied', 'Pied de page', 'Fixe')}</div>
          <div style="padding:0 16px 16px"><button type="button" class="btn" data-act="lib">+ Ajouter un bloc</button></div></section>
        ${UI.lib ? card('Ajouter un bloc', `<p class="hint" style="margin:0">Le bloc sera ajouté ${typeof cur === 'number' ? 'sous « ' + esc(blocName(blocs[cur])) + ' »' : 'en bas de la page'}.</p><div class="lib">${lib}</div>`, '<button type="button" class="btn btn-sm btn-ghost" data-act="lib">Fermer</button>') : ''}
      </div><div class="sticky">${inspector(cur)}</div></div>`;
  };
  function inspector(cur) {
    const go = (h, t) => `<a class="btn" href="#${h}">${t} →</a>`;
    if (cur === 'tete') return card('Bandeau & en-tête', inp('general', 'dates_bandeau', 'Dates (bandeau)') + inp('general', 'lieu', 'Lieu') +
      `<div class="g2">${inp('general', 'hexagone_jours', 'Hexagone : jours')}${inp('general', 'hexagone_mois', 'Hexagone : mois')}</div>` + inp('general', 'accroche', 'Accroche sous le logo') +
      `<div class="g2">${inp('billetterie', 'hero_sous_titre', 'Plaque billetterie : texte')}${inp('billetterie', 'hero_statut', 'Plaque billetterie : statut')}</div>`);
    if (cur === 'pied') return card('Pied de page', inp('general', 'pied_de_page', 'Texte') + inp('general', 'lien_contact', 'Lien « Contact »', { ph: 'https://… ou mailto:…' }) + inp('general', 'lien_mentions', 'Lien « Mentions légales »', { ph: 'https://…' }));
    const b = (S.c.accueil.blocs || [])[cur];
    if (!b) return card('Inspecteur', '<p class="empty-state">Sélectionne un bloc pour le modifier.</p>');
    const P = 'blocs.' + cur + '.', meta = BLOCS[b.type] || { t: b.type };
    const head = sw('accueil', P + 'visible', 'Visible sur le site', true) + (meta.libre ? `<button type="button" class="btn btn-sm btn-danger" data-act="del" data-file="accueil" data-path="blocs" data-i="${cur}">Supprimer le bloc</button>` : '');
    let body = '';
    switch (b.type) {
      case 'compte-a-rebours': body = inp('general', 'depart', 'Ouverture des portes (heure de Paris)', { type: 'datetime-local', hint: 'Le compte à rebours arrive à zéro à ce moment-là.' }) + inp('general', 'depart_titre', 'Titre') + inp('general', 'depart_texte', 'Date affichée') + inp('general', 'depart_phrase', 'Phrase', { area: true, rows: 2 }); break;
      case 'programmation': body = inp('programmation', 'surtitre', 'Surtitre') + inp('programmation', 'titre', 'Titre') + inp('programmation', 'intro', 'Intro', { area: true, rows: 3 }) +
        `<div class="g2">${inp('programmation', 'vendredi', 'Vendredi : libellé')}${inp('programmation', 'vendredi_nom', 'Vendredi : surnom')}${inp('programmation', 'samedi', 'Samedi : libellé')}${inp('programmation', 'samedi_nom', 'Samedi : surnom')}</div>` + go('programmation', 'Gérer les artistes'); break;
      case 'infos': body = inp('infos', 'surtitre', 'Surtitre') + inp('infos', 'titre', 'Titre') + go('infos', 'Gérer les cartes et popups'); break;
      case 'replay': body = inp('replay', 'surtitre', 'Surtitre') + inp('replay', 'titre', 'Titre') + `<div class="g2">${inp('replay', 'bouton_texte', 'Texte du bouton')}${inp('replay', 'lien_galerie', 'Lien de la galerie')}</div>` + inp('replay', 'credit', 'Crédit photo') + go('medias', 'Gérer les photos'); break;
      case 'billetterie': body = inp('billetterie', 'titre', 'Titre') + inp('billetterie', 'texte', 'Texte', { area: true, rows: 3 }) + imgField('billetterie', 'photo', 'Photo') + go('billetterie', 'Gérer les pass'); break;
      case 'partenaires': body = inp('partenaires', 'titre', 'Titre') + inp('partenaires', 'appel', 'Phrase d’appel') + inp('partenaires', 'email', 'E-mail partenariats', { type: 'email', req: true }) + go('partenaires', 'Gérer les logos'); break;
      case 'benevoles': body = inp('accueil', P + 'surtitre', 'Surtitre') + inp('accueil', P + 'titre', 'Titre') + inp('accueil', P + 'texte', 'Texte', { area: true, rows: 3 }) +
        `<div class="g2">${inp('accueil', P + 'bouton_texte', 'Texte du bouton')}${inp('accueil', P + 'bouton_lien', 'Lien du formulaire', { req: true, ph: 'https://…' })}</div>` + imgField('accueil', P + 'photo', 'Photo'); break;
      case 'texte-libre': body = seg('accueil', P + 'fond', 'Fond', FONDS) + inp('accueil', P + 'surtitre', 'Surtitre', { ph: '→ NOUVEAUTÉ 2027' }) + inp('accueil', P + 'titre', 'Titre') + inp('accueil', P + 'texte', 'Texte', { area: true, hint: TODO_HINT }) +
        imgField('accueil', P + 'image', 'Image (facultative)') + `<div class="g2">${inp('accueil', P + 'bouton_texte', 'Texte du bouton')}${inp('accueil', P + 'bouton_lien', 'Lien du bouton', { ph: 'https://… ou #billetterie' })}</div>`; break;
      case 'annonce': body = seg('accueil', P + 'fond', 'Fond', FONDS) + inp('accueil', P + 'texte', 'Message') + `<div class="g2">${inp('accueil', P + 'bouton_texte', 'Texte du bouton')}${inp('accueil', P + 'bouton_lien', 'Lien du bouton', { ph: 'https://… ou #billetterie' })}</div>`; break;
    }
    return card(esc(blocName(b)), `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">${head}</div>` + body);
  }
  function bindDrag() {
    const list = $('#blist'); if (!list) return;
    let from = null;
    list.addEventListener('dragstart', (e) => { const b = e.target.closest('.blk[draggable]'); if (!b) return; from = +b.dataset.i; b.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(from)); });
    list.addEventListener('dragend', () => { list.querySelectorAll('.blk').forEach((x) => x.classList.remove('dragging', 'drop-before')); });
    list.addEventListener('dragover', (e) => { const b = e.target.closest('.blk[draggable]'); if (from == null || !b) return; e.preventDefault(); list.querySelectorAll('.drop-before').forEach((x) => x.classList.remove('drop-before')); b.classList.add('drop-before'); });
    list.addEventListener('drop', (e) => {
      const b = e.target.closest('.blk[draggable]'); if (from == null || !b) return; e.preventDefault();
      const to = +b.dataset.i, arr = S.c.accueil.blocs, item = arr.splice(from, 1)[0];
      arr.splice(to > from ? to - 1 : to, 0, item); UI.sel.pages = arr.indexOf(item); from = null;
      save('accueil'); refresh();
    });
  }

  /* ---------- Écran : programmation ---------- */
  const mins = (h) => { const p = String(h || '').toLowerCase().split(/[h:]/); const m = (+p[0] || 0) * 60 + (+p[1] || 0); return m < 720 ? m + 1440 : m; };
  const TIME = /^\d{2}h\d{2}$/;
  function progRows() {
    const A = S.c.programmation.artistes || [];
    const idx = A.map((a, i) => i).filter((i) => UI.jour === 'tous' || A[i].jour === UI.jour)
      .sort((x, y) => (A[x].jour === A[y].jour ? 0 : A[x].jour === 'ven' ? -1 : 1) || mins(A[x].debut) - mins(A[y].debut));
    if (!idx.length) return '<tr><td colspan="7" class="empty-state">Aucun artiste ce jour-là.</td></tr>';
    const c = (ok, warn) => `<span class="chk ${ok ? 'y' : warn ? 'w' : 'n'}">${ok ? '✓' : warn ? '!' : '–'}</span>`;
    return idx.map((i) => {
      const a = A[i], sc = SCENES[a.scene] || SCENES.arena;
      return `<tr class="r ${UI.sel.prog === i ? 'sel' : ''} ${a.publie === false ? 'hid' : ''}" data-act="selart" data-i="${i}" tabindex="0">
        <td class="time">${esc(a.debut)}<span class="muted small"> → ${esc(a.fin)}</span></td><td><strong>${esc(a.nom)}</strong></td>
        <td style="white-space:nowrap"><span class="dot" style="background:${sc[1]};border:1px solid #17171A"></span> ${sc[0]}</td><td>${a.jour === 'sam' ? 'Sam.' : 'Ven.'}</td>
        <td title="Photo">${c(!!a.photo, true)}</td><td title="Présentation">${c(a.bio && !/\[\[/.test(a.bio), true)}</td><td title="Écoute">${a.sans_ecoute ? c(false, false) : c(!!a.ecoute, true)}</td>
        <td><span class="pill ${a.publie === false ? 'draft' : 'ok'}">${a.publie === false ? 'Masqué' : 'Publié'}</span></td></tr>`;
    }).join('');
  }
  SCREENS.programmation = function () {
    const A = S.c.programmation.artistes || [], i = UI.sel.prog, a = A[i];
    const P = 'artistes.' + i + '.';
    const editor = a ? card('Fiche artiste', imgField('programmation', P + 'photo', 'Photo presse', true) + inp('programmation', P + 'nom', 'Nom', { req: true }) +
        seg('programmation', P + 'jour', 'Jour', [['ven', S.c.programmation.vendredi || 'Vendredi'], ['sam', S.c.programmation.samedi || 'Samedi']]) +
        seg('programmation', P + 'scene', 'Scène', [['arena', 'Speed Arena', '#FF5500'], ['boiler', 'Boiler Vroom', '#00FF97']]) +
        `<div class="g2">${inp('programmation', P + 'debut', 'Début', { req: true, pattern: TIME, ph: '23h30' })}${inp('programmation', P + 'fin', 'Fin', { req: true, pattern: TIME, ph: '00h30' })}</div>` +
        inp('programmation', P + 'bio', 'Présentation', { area: true, rows: 5, req: true, hint: TODO_HINT }) +
        inp('programmation', P + 'ecoute', 'Lien d’écoute (magic link)', { ph: 'https://…', hint: 'Une page qui laisse choisir sa plateforme (Spotify, Deezer…). Vide : « bientôt disponible ».' }) +
        sw('programmation', P + 'sans_ecoute', 'Pas de bouton d’écoute (tremplin, end show…)') + sw('programmation', P + 'publie', 'Publié sur le site', true),
        `<button type="button" class="btn btn-sm btn-danger" data-act="del" data-file="programmation" data-path="artistes" data-i="${i}">Supprimer</button>`)
      : card('Fiche artiste', '<p class="empty-state">Clique sur un artiste pour modifier sa fiche, ou ajoutes-en un.</p>');
    return `<div class="split"><section class="card"><div class="card-h"><div class="seg" role="group" aria-label="Filtrer par jour">${[['tous', 'Tous'], ['ven', 'Vendredi'], ['sam', 'Samedi']].map((x) => `<button type="button" data-act="jour" data-v="${x[0]}" class="${UI.jour === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
        <button type="button" class="btn btn-dark" data-act="addart">+ Ajouter un artiste</button></div>
        <div class="tbl-wrap"><table><thead><tr><th>Horaire</th><th>Artiste</th><th>Scène</th><th>Jour</th><th>Photo</th><th>Bio</th><th>Écoute</th><th>Statut</th></tr></thead><tbody id="prog-body">${progRows()}</tbody></table></div>
        <p class="hint" style="padding:0 18px 14px;margin:0">Les artistes sont rangés automatiquement par horaire sur le site. Les textes de la section (titre, jours) se modifient dans <a href="#pages/programmation">Pages &amp; blocs</a>.</p></section>
      <div class="sticky">${editor}</div></div>`;
  };

  /* ---------- Écran : billetterie ---------- */
  function passPreview() {
    const B = S.c.billetterie, pass = B.pass || [];
    if (!pass.length) return '<p class="muted">Aucun pass.</p>';
    return pass.map((p) => {
      const c = HEX[p.couleur] || '#FF5500', big = p.en_vedette;
      const prix = p.statut === 'complet' ? 'COMPLET' : p.prix || 'BIENTÔT';
      return `<div class="pv-pass ${p.statut === 'complet' ? 'sold' : ''}" style="background:${c};box-shadow:0 0 0 5px ${c}"><div class="pv-top"><span class="plq" style="font-size:${big ? 30 : 24}px">${esc(p.nom)}</span><span class="plq" style="font-size:${big ? 26 : 20}px">${esc(prix)}</span></div>
        <div class="pv-bar" style="color:${c}"><span>${esc(p.bandeau)}</span>${big ? `<span>★★★</span><span>${esc(p.bandeau_droite)}</span>` : ''}</div></div>`;
    }).join('');
  }
  SCREENS.billetterie = function () {
    const pass = S.c.billetterie.pass || [];
    const items = pass.map((p, i) => {
      const P = 'pass.' + i + '.';
      return `<div class="item">${tools('billetterie', 'pass', i, pass.length, 'Supprimer le pass')}<div style="display:flex;flex-direction:column;gap:12px">
        <div class="g3">${inp('billetterie', P + 'nom', 'Nom du pass', { req: true })}${inp('billetterie', P + 'prix', 'Prix', { req: true, ph: '49 €', hint: 'Vide : « BIENTÔT »' })}${sel('billetterie', P + 'statut', 'Statut', [['vente', 'En vente'], ['bientot', 'Bientôt'], ['complet', 'Complet']])}</div>
        ${seg('billetterie', P + 'couleur', 'Couleur', COUL)}
        <div class="g2">${inp('billetterie', P + 'bandeau', 'Texte du bandeau noir')}${p.en_vedette ? inp('billetterie', P + 'bandeau_droite', 'Bandeau : texte de droite') : ''}</div>
        ${inp('billetterie', P + 'lien', 'Lien d’achat', { ph: 'https://…', hint: 'Vide : le lien général de la billetterie est utilisé.' })}
        ${sw('billetterie', P + 'en_vedette', 'Grande plaque (en vedette)')}</div></div>`;
    }).join('');
    return `<div class="split"><div style="display:flex;flex-direction:column;gap:20px">
        ${card('Vente en ligne', inp('billetterie', 'lien', 'Lien de la billetterie', { req: true, ph: 'https://…', hint: 'Plateforme de vente (HelloAsso, Weezevent…). Utilisé par tous les pass sans lien propre.' }) +
          `<div class="g2">${inp('billetterie', 'hero_sous_titre', 'Plaque d’accueil : texte')}${inp('billetterie', 'hero_statut', 'Plaque d’accueil : statut', { ph: 'OUVERTE' })}</div>`)}
        <section class="card"><div class="card-h"><h2>Pass</h2><button type="button" class="btn" data-act="add" data-file="billetterie" data-path="pass" data-tpl="pass">+ Ajouter un pass</button></div><div class="items">${items || '<p class="empty-state">Aucun pass.</p>'}</div></section>
        ${card('Section du site', inp('billetterie', 'titre', 'Titre') + inp('billetterie', 'texte', 'Texte', { area: true, rows: 3 }) + imgField('billetterie', 'photo', 'Photo'))}
      </div><div class="sticky">${card('Aperçu des plaques', `<div class="preview-zone" id="pass-preview">${passPreview()}</div><p class="hint" style="margin:0">Les champs vides sont surlignés en jaune.</p>`)}</div></div>`;
  };

  /* ---------- Écran : infos pratiques ---------- */
  SCREENS.infos = function () {
    const C = S.c.infos.cartes || [], i = Math.min(UI.sel.infos, C.length - 1), c = C[i];
    const list = C.map((x, k) => `<button type="button" class="blk ${k === i ? 'sel' : ''}" data-act="selcard" data-i="${k}"><span class="color-dot" style="background:${HEX[x.couleur] || '#ccc'}"></span><span class="blk-name">${esc(x.titre)}</span>${todos(x) ? `<span class="todo-count">${todos(x)} à compléter</span>` : ''}</button>`).join('');
    let ed = card('Carte', '<p class="empty-state">Ajoute une carte.</p>');
    if (c) {
      const P = 'cartes.' + i + '.';
      const sub = (key, tpl, label, row) => {
        const arr = c[key] || [];
        return `<div class="field"><span class="flabel">${label}</span><div style="display:flex;flex-direction:column;gap:8px">${arr.map((x, k) => row(P + key + '.' + k, k, arr.length)).join('')}</div>
          <div><button type="button" class="btn btn-sm" data-act="add" data-file="infos" data-path="${P + key}" data-tpl="${tpl}">+ Ajouter</button></div></div>`;
      };
      const mini = (path, k, n, key) => `<div style="display:flex;gap:4px">${tools('infos', P + key, k, n).replace('item-tools', 'item-tools" style="flex-direction:row')}</div>`;
      ed = card('Carte « ' + esc(c.titre) + ' »', `<div class="g2">${inp('infos', P + 'titre', 'Titre', { req: true })}${seg('infos', P + 'couleur', 'Couleur', COUL.slice(0, 5))}</div>` +
        inp('infos', P + 'resume', 'Résumé sur la carte', { area: true, rows: 2 }) + imgField('infos', P + 'photo', 'Photo') +
        `<div class="g2">${sel('infos', P + 'pictogramme', 'Pictogramme', [['triangle', 'Triangle'], ['hexagone', 'Hexagone'], ['tente', 'Rond + tente'], ['interdit', 'Rond barré'], ['rond', 'Rond avec texte']])}${inp('infos', P + 'texte_pictogramme', 'Texte du pictogramme', { ph: '!!!' })}</div>` +
        '<hr style="border:0;border-top:1px solid #EFEDE8;margin:4px 0"><strong>Contenu de la popup</strong>' +
        inp('infos', P + 'intro', 'Texte d’introduction', { area: true, rows: 2 }) +
        sub('horaires', 'horaire', 'Tableau des horaires', (p, k, n) => `<div class="mini-row four">${inp('infos', p + '.jour', '', { ph: 'Jour' })}${inp('infos', p + '.ouverture', '', { ph: 'Ouverture' })}${inp('infos', p + '.premier_depart', '', { ph: 'Premier départ' })}${inp('infos', p + '.fermeture', '', { ph: 'Fermeture' })}${mini(p, k, n, 'horaires')}</div>`) +
        sub('lignes', 'ligne', 'Rubriques', (p, k, n) => `<div class="mini-row" style="padding:10px;border:1px solid #EFEDE8;border-radius:10px"><div style="display:flex;flex-direction:column;gap:8px">${inp('infos', p + '.titre', '', { ph: 'Titre (ex. Parking)' })}${inp('infos', p + '.texte', '', { area: true, rows: 2, req: false })}</div>${mini(p, k, n, 'lignes')}</div>`) +
        `<p class="hint" style="margin:0">${TODO_HINT}</p>` +
        sub('interdits', 'interdit', 'Liste d’objets interdits (pictos barrés)', (p, k, n) => `<div class="mini-row">${inp('infos', p, '', { ph: 'Objet interdit' })}${mini(p, k, n, 'interdits')}</div>`) +
        `<div class="g2">${inp('infos', P + 'bouton_texte', 'Bouton : texte')}${inp('infos', P + 'bouton_lien', 'Bouton : lien', { ph: 'https://… ou #billetterie' })}</div>`,
        `<button type="button" class="btn btn-sm btn-danger" data-act="del" data-file="infos" data-path="cartes" data-i="${i}">Supprimer la carte</button>`);
    }
    return `<div class="split split-infos"><section class="card" style="align-self:start"><div class="card-h"><h2>Cartes « Briefing pilotes »</h2></div><div class="blist">${list}</div>
        <div style="padding:0 16px 16px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" data-act="add" data-file="infos" data-path="cartes" data-tpl="carte">+ Ajouter une carte</button>
        ${c ? `<button type="button" class="icon-btn" data-act="up" data-file="infos" data-path="cartes" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Monter la carte">↑</button><button type="button" class="icon-btn" data-act="down" data-file="infos" data-path="cartes" data-i="${i}" ${i === C.length - 1 ? 'disabled' : ''} aria-label="Descendre la carte">↓</button>` : ''}</div></section>
      <div>${ed}</div></div>`;
  };

  /* ---------- Écran : médias ---------- */
  SCREENS.medias = function () {
    const ph = S.c.replay.photos || [];
    const items = ph.map((p, i) => {
      const P = 'photos.' + i + '.';
      return `<div class="item">${tools('replay', 'photos', i, ph.length, 'Retirer la photo')}<div class="photo-card">${imgField('replay', P + 'image', 'Image')}
        <div style="display:flex;flex-direction:column;gap:10px">${inp('replay', P + 'description', 'Description', { req: true, hint: 'Lue par les lecteurs d’écran et affichée dans la visionneuse.' })}
        <div class="g2">${sel('replay', P + 'format', 'Taille dans la mosaïque', [['normal', 'Normale'], ['large', 'Large (2 colonnes)'], ['haut', 'Haute (2 lignes)'], ['grand', 'Grande (2 × 2)']])}${inp('replay', P + 'etiquette', 'Étiquette', { ph: 'LE PADDOCK' })}</div>
        ${p.etiquette ? seg('replay', P + 'couleur', 'Couleur de l’étiquette', COUL.slice(0, 5)) : ''}</div></div></div>`;
    }).join('');
    const lib = S.medias.map((m) => `<div class="media"><div class="mimg" style="background-image:url('${esc(src(m.src))}')"></div><div class="mcap" title="${esc(m.src)}">${esc(m.src.split('/').pop())}</div>
      ${m.envoi ? `<button type="button" class="btn btn-sm btn-ghost btn-danger" data-act="delmedia" data-src="${esc(m.src)}">Supprimer</button>` : ''}</div>`).join('');
    return card('Section « Replay »', `<div class="g2">${inp('replay', 'surtitre', 'Surtitre')}${inp('replay', 'titre', 'Titre')}</div><div class="g2">${inp('replay', 'bouton_texte', 'Texte du bouton')}${inp('replay', 'lien_galerie', 'Lien de la galerie complète')}</div>${inp('replay', 'credit', 'Crédit photo')}`) +
      `<section class="card"><div class="card-h"><h2>Photos de la mosaïque (${ph.length})</h2><div class="acts"><button type="button" class="btn btn-dark" data-act="addphotos">+ Envoyer des photos</button><button type="button" class="btn" data-act="add" data-file="replay" data-path="photos" data-tpl="photo">+ Depuis la bibliothèque</button></div></div><div class="items">${items || '<p class="empty-state">Aucune photo.</p>'}</div></section>` +
      card('Bibliothèque d’images', `<p class="hint" style="margin:0">Toutes les images du site. Seules celles envoyées depuis le back-office peuvent être supprimées.</p><div class="media-grid">${lib}</div>`, '<button type="button" class="btn" data-act="uploadlib">+ Envoyer</button>');
  };

  /* ---------- Écran : partenaires ---------- */
  SCREENS.partenaires = function () {
    const L = S.c.partenaires.logos || [];
    const items = L.map((l, i) => `<div class="item">${tools('partenaires', 'logos', i, L.length, 'Retirer le partenaire')}<div class="photo-card">${imgField('partenaires', 'logos.' + i + '.logo', 'Logo')}
      <div style="display:flex;flex-direction:column;gap:10px">${inp('partenaires', 'logos.' + i + '.nom', 'Nom')}${inp('partenaires', 'logos.' + i + '.lien', 'Site web', { ph: 'https://…' })}</div></div></div>`).join('');
    return card('Section « Partenaires »', inp('partenaires', 'titre', 'Titre') + inp('partenaires', 'appel', 'Phrase d’appel') + inp('partenaires', 'email', 'E-mail partenariats', { type: 'email', req: true, hint: 'Utilisé par le bouton « Devenir partenaire ».' })) +
      `<section class="card"><div class="card-h"><h2>Logos (${L.length})</h2><button type="button" class="btn btn-dark" data-act="add" data-file="partenaires" data-path="logos" data-tpl="logo">+ Ajouter un partenaire</button></div><div class="items">${items || '<p class="empty-state">Aucun logo : des emplacements vides s’affichent sur le site.</p>'}</div></section>`;
  };

  /* ---------- Écran : réglages ---------- */
  SCREENS.reglages = function () {
    const team = S.equipe.map((u) => `<div class="row"><span class="av" aria-hidden="true">${esc(u.nom.slice(0, 2).toUpperCase())}</span><div style="flex:1"><strong>${esc(u.nom)}</strong> <span class="muted small">${esc(u.login)}</span></div>
      ${u.login === S.user.login ? '<span class="pill draft">Toi</span>' : `<button type="button" class="btn btn-sm btn-danger" data-act="delmember" data-login="${esc(u.login)}">Retirer</button>`}</div>`).join('');
    const backups = S.sauvegardes.slice(0, 12).map((b) => { const m = b.match(/^(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)/); return `<div class="row"><div style="flex:1">Publication du ${m ? m[3] + '/' + m[2] + '/' + m[1] + ' à ' + m[4] + 'h' + m[5] : esc(b)}</div><button type="button" class="btn btn-sm" data-act="restore" data-id="${esc(b)}">Restaurer en brouillon</button></div>`; }).join('');
    return `<div class="cols"><div style="display:flex;flex-direction:column;gap:20px">
      ${card('Édition', `<div class="g2">${inp('general', 'dates_bandeau', 'Dates affichées', { ph: '28/29 AOÛT 2027' })}${inp('general', 'lieu', 'Lieu')}</div>` +
        inp('general', 'depart', 'Ouverture des portes (compte à rebours, heure de Paris)', { type: 'datetime-local', req: true }) + inp('general', 'depart_texte', 'Date affichée sous le compte à rebours') +
        `<div class="g2">${inp('general', 'hexagone_jours', 'Hexagone : jours')}${inp('general', 'hexagone_mois', 'Hexagone : mois')}</div>` + inp('general', 'accroche', 'Accroche'))}
      ${card('Pied de page', inp('general', 'pied_de_page', 'Texte') + inp('general', 'lien_contact', 'Lien « Contact »', { ph: 'mailto:… ou https://…' }) + inp('general', 'lien_mentions', 'Lien « Mentions légales »'))}
      </div><div style="display:flex;flex-direction:column;gap:20px">
      <section class="card"><div class="card-h"><h2>Équipe</h2></div><div>${team}</div>
        <form class="card-b" data-form="member" style="border-top:1px solid #EFEDE8"><strong>Ajouter un membre</strong><div class="g2"><div class="field"><label for="m-nom">Nom</label><input class="inp" id="m-nom" name="nom" required maxlength="60"></div><div class="field"><label for="m-login">Identifiant</label><input class="inp" id="m-login" name="login" required autocapitalize="none"></div></div>
        <div class="field"><label for="m-pass">Mot de passe provisoire</label><input class="inp" id="m-pass" name="mot_de_passe" type="text" required minlength="10" autocomplete="off"><span class="hint">10 caractères minimum. Transmets-le à la personne : elle pourra le changer ici.</span></div><div><button class="btn btn-dark" type="submit">Ajouter</button></div></form></section>
      <section class="card"><div class="card-h"><h2>Mon mot de passe</h2></div><form class="card-b" data-form="password"><div class="field"><label for="p-old">Mot de passe actuel</label><input class="inp" id="p-old" name="actuel" type="password" required autocomplete="current-password"></div>
        <div class="field"><label for="p-new">Nouveau mot de passe</label><input class="inp" id="p-new" name="nouveau" type="password" required minlength="10" autocomplete="new-password"></div><div><button class="btn btn-dark" type="submit">Changer</button></div></form></section>
      <section class="card"><div class="card-h"><h2>Sauvegardes</h2><span class="muted small">Une copie à chaque publication</span></div><div>${backups || '<p class="empty-state">Pas encore de sauvegarde : elles apparaîtront après la première publication.</p>'}</div></section>
      </div></div>`;
  };

  /* ---------- Bibliothèque d'images (fenêtre) ---------- */
  function pickImage(file, path) {
    const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Choisir une image');
    const draw = () => {
      m.innerHTML = `<div class="modal-card"><div class="card-h"><h2>Choisir une image</h2><div class="acts"><button type="button" class="btn btn-dark" data-m="up">+ Envoyer une image</button><button type="button" class="btn" data-m="close">Fermer</button></div></div>
        <div class="card-b"><div class="media-grid">${S.medias.map((x) => `<button type="button" class="media" data-m="pick" data-src="${esc(x.src)}"><span class="mimg" style="display:block;background-image:url('${esc(src(x.src))}')"></span><span class="mcap">${esc(x.src.split('/').pop())}</span></button>`).join('')}</div></div></div>`;
    };
    draw(); document.body.appendChild(m);
    const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    m.addEventListener('click', (e) => {
      if (e.target === m) return close();
      const b = e.target.closest('[data-m]'); if (!b) return;
      if (b.dataset.m === 'close') close();
      if (b.dataset.m === 'pick') { set(S.c[file], path, b.dataset.src); save(file); close(); refresh(); }
      if (b.dataset.m === 'up') chooseFiles(false).then((files) => upload(files[0])).then((s) => { set(S.c[file], path, s); save(file); close(); refresh(); toast('Image envoyée'); }).catch((err) => err && toast(err.message, true));
    });
    m.querySelector('[data-m="close"]').focus();
  }
  function chooseFiles(multiple) {
    return new Promise((res, rej) => {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/jpeg,image/png,image/webp,image/gif'; f.multiple = !!multiple;
      f.addEventListener('change', () => (f.files.length ? res(Array.from(f.files)) : rej(null)));
      f.click();
    });
  }

  /* ---------- Événements ---------- */
  function onField(e) {
    const el = e.target.closest('[data-f]'); if (!el || !el.matches('input,textarea,select')) return;
    const file = el.dataset.file; set(S.c[file], el.dataset.f, el.value);
    if (el.dataset.req) { const pat = el.dataset.pattern ? new RegExp(el.dataset.pattern) : null; el.classList.toggle('empty', !el.value || (pat && !pat.test(el.value))); }
    save(file);
    const r = route().r;
    if (r === 'programmation') { const tb = $('#prog-body'); if (tb) tb.innerHTML = progRows(); }
    if (r === 'billetterie') { const pv = $('#pass-preview'); if (pv) pv.innerHTML = passPreview(); }
    if (r === 'pages' && /\.(titre|texte)$/.test(el.dataset.f) && file === 'accueil') { const n = app.querySelector(`#blist .blk.sel .blk-name`); const b = S.c.accueil.blocs[UI.sel.pages]; if (n && b) n.textContent = blocName(b); }
    if (e.type === 'change' && el.tagName === 'SELECT' && r !== 'billetterie') refresh();
    navCounts();
  }
  app.addEventListener('input', onField);
  app.addEventListener('change', onField);

  app.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act, file = t.dataset.file, d = t.dataset;
    const arr = () => get(S.c[file], d.path);
    switch (act) {
      case 'sw': { const cur = get(S.c[file], d.f); const on = cur == null ? !!d.dflt : !!cur; set(S.c[file], d.f, !on); save(file); refresh(); break; }
      case 'seg': set(S.c[file], d.f, d.v); save(file); refresh(); break;
      case 'clear': e.stopPropagation(); set(S.c[file], d.f, ''); save(file); refresh(); break;
      case 'pick': e.stopPropagation(); pickImage(file, d.f); break;
      case 'up': case 'down': {
        e.stopPropagation(); const a = arr(), i = +d.i, j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]];
        if (file === 'accueil' && UI.sel.pages === i) UI.sel.pages = j;
        if (file === 'infos' && d.path === 'cartes') UI.sel.infos = j;
        save(file); refresh(); break;
      }
      case 'del': {
        e.stopPropagation(); const a = arr(), it = a[+d.i];
        const label = it && typeof it === 'object' ? (it.nom || it.titre || it.texte || it.description || 'cet élément') : 'cet élément';
        if (!confirm('Supprimer « ' + label + ' » ?')) return;
        a.splice(+d.i, 1);
        if (file === 'programmation') UI.sel.prog = -1;
        if (file === 'accueil') UI.sel.pages = 'tete';
        if (file === 'infos' && d.path === 'cartes') UI.sel.infos = 0;
        save(file); refresh(); break;
      }
      case 'add': {
        let a = arr(); if (!Array.isArray(a)) { set(S.c[file], d.path, []); a = arr(); }
        a.push(TPL[d.tpl]());
        if (file === 'infos' && d.path === 'cartes') UI.sel.infos = a.length - 1;
        save(file); refresh();
        if (d.tpl === 'photo') pickImage(file, d.path + '.' + (a.length - 1) + '.image');
        break;
      }
      case 'selblk': UI.sel.pages = /^\d+$/.test(d.i) ? +d.i : d.i; if (location.hash !== '#pages') history.replaceState(null, '', '#pages'); refresh(); break;
      case 'lib': UI.lib = !UI.lib; refresh(); break;
      case 'go-lib': UI.lib = true; break;
      case 'addblk': {
        const blocs = S.c.accueil.blocs, at = typeof UI.sel.pages === 'number' ? UI.sel.pages + 1 : blocs.length;
        blocs.splice(at, 0, TPL[d.type] ? TPL[d.type]() : { type: d.type, visible: true });
        UI.sel.pages = at; UI.lib = false; save('accueil'); refresh(); break;
      }
      case 'selart': UI.sel.prog = +d.i; refresh(); if (innerWidth < 1100) { const ed = $('.sticky'); if (ed) ed.scrollIntoView({ behavior: 'smooth' }); } break;
      case 'go-add-artist': UI.addArtist = true; break;
      case 'jour': UI.jour = d.v; refresh(); break;
      case 'addart': { const A = S.c.programmation.artistes; A.push(TPL.artiste()); UI.sel.prog = A.length - 1; save('programmation'); refresh(); const n = $('[data-f="artistes.' + (A.length - 1) + '.nom"]'); if (n) { n.focus(); n.select(); } break; }
      case 'selcard': UI.sel.infos = +d.i; refresh(); if (innerWidth < 1100) { const ed = $('.split-infos > div'); if (ed) ed.scrollIntoView({ behavior: 'smooth' }); } break;
      case 'addphotos': chooseFiles(true).then(async (files) => {
          toast('Envoi de ' + plural(files.length, 'photo') + '…');
          for (const f of files) { const s = await upload(f); S.c.replay.photos.push(Object.assign(TPL.photo(), { image: s })); }
          save('replay'); refresh(); toast(plural(files.length, 'photo ajoutée', 'photos ajoutées') + ' : pense à les décrire.');
        }).catch((err) => err && toast(err.message, true)); break;
      case 'uploadlib': chooseFiles(true).then(async (files) => { for (const f of files) await upload(f); refresh(); toast('Images envoyées'); }).catch((err) => err && toast(err.message, true)); break;
      case 'delmedia': if (!confirm('Supprimer définitivement cette image du serveur ?')) return; api('supprimer_media', { src: d.src }).then((j) => { S.medias = j.medias; refresh(); }).catch((err) => toast(err.message, true)); break;
      case 'delmember': if (!confirm('Retirer ce membre ? Il ne pourra plus se connecter.')) return; api('equipe_retirer', { login: d.login }).then((j) => { S.equipe = j.equipe; refresh(); toast('Membre retiré'); }).catch((err) => toast(err.message, true)); break;
      case 'restore': if (!confirm('Charger cette sauvegarde en brouillon ? Tu pourras la vérifier avec l’aperçu, puis publier.')) return;
        flush().then(() => api('restaurer', { id: d.id })).then((j) => { S.c = j.contenus; S.brouillons = j.brouillons; refresh(); toast('Sauvegarde chargée en brouillon'); }).catch((err) => toast(err.message, true)); break;
      case 'publier':
        t.disabled = true;
        flush().then(() => api('publier', {})).then((j) => { S.brouillons = []; S.pub = j.derniere_publication; S.sauvegardes = j.sauvegardes; UI.savedAt = 0; return reloadJournal(); })
          .then(() => { refresh(); toast('Publié ! Le site est à jour.'); }).catch((err) => { toast(err.message, true); topStatus(); }); break;
      case 'annuler': if (!confirm('Annuler toutes les modifications non publiées ?')) return;
        Object.keys(timers).forEach((f) => { clearTimeout(timers[f]); delete timers[f]; }); UI.saving = 0;
        api('annuler', {}).then((j) => { S.c = j.contenus; S.brouillons = []; UI.savedAt = 0; refresh(); toast('Modifications annulées'); }).catch((err) => toast(err.message, true)); break;
    }
  });
  app.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act="selblk"],[data-act="selart"],.sw[data-act]')) { e.preventDefault(); e.target.click(); }
  });
  app.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
    const data = Object.fromEntries(new FormData(f).entries());
    if (f.dataset.form === 'member') api('equipe_ajouter', data).then((j) => { S.equipe = j.equipe; refresh(); toast('Membre ajouté'); }).catch((err) => toast(err.message, true));
    if (f.dataset.form === 'password') api('mot_de_passe', data).then(() => { f.reset(); toast('Mot de passe changé'); }).catch((err) => toast(err.message, true));
  });
  /* Glisser-déposer d'images sur les zones « Dépose une image ici » */
  app.addEventListener('dragover', (e) => { const z = e.target.closest('[data-drop]'); if (z && e.dataTransfer.types.indexOf('Files') >= 0) { e.preventDefault(); z.classList.add('over'); } });
  app.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-drop]'); if (z) z.classList.remove('over'); });
  app.addEventListener('drop', (e) => {
    const z = e.target.closest('[data-drop]'); if (!z || !e.dataTransfer.files.length) return; e.preventDefault();
    upload(e.dataTransfer.files[0]).then((s) => { set(S.c[z.dataset.file], z.dataset.f, s); save(z.dataset.file); refresh(); toast('Image envoyée'); }).catch((err) => toast(err.message, true));
  });
  app.addEventListener('click', (e) => { const z = e.target.closest('[data-drop]'); if (z && !e.target.closest('button')) pickImage(z.dataset.file, z.dataset.f); });

  window.addEventListener('hashchange', () => { UI.lib = UI.lib && route().r === 'pages'; render(); window.scrollTo(0, 0); if (UI.addArtist) { UI.addArtist = false; const b = $('[data-act="addart"]'); if (b) b.click(); } });
  window.addEventListener('beforeunload', (e) => { if (Object.keys(timers).length || UI.saving) { e.preventDefault(); e.returnValue = ''; } });

  function reloadJournal() { return api('etat').then((j) => { S.journal = j.journal; }); }
  api('etat').then((j) => {
    S.c = j.contenus; S.brouillons = j.brouillons; S.journal = j.journal; S.medias = j.medias; S.equipe = j.equipe; S.sauvegardes = j.sauvegardes; S.user = j.utilisateur; S.pub = j.derniere_publication;
    ['accueil', 'programmation', 'billetterie', 'infos', 'replay', 'partenaires', 'general'].forEach((k) => { if (!S.c[k] || Array.isArray(S.c[k])) S.c[k] = {}; });
    if (!Array.isArray(S.c.accueil.blocs)) S.c.accueil.blocs = [];
    if (!Array.isArray(S.c.programmation.artistes)) S.c.programmation.artistes = [];
    if (!Array.isArray(S.c.billetterie.pass)) S.c.billetterie.pass = [];
    if (!Array.isArray(S.c.infos.cartes)) S.c.infos.cartes = [];
    if (!Array.isArray(S.c.replay.photos)) S.c.replay.photos = [];
    render();
  }).catch((e) => { app.innerHTML = '<p class="boot">Impossible de charger le back-office : ' + esc(e.message) + '</p>'; });
})();
