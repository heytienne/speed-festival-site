/* Speed Festival — scripts du site
   Tous les contenus viennent des fichiers du dossier content/ (modifiables depuis le back-office admin/).
   Mode aperçu (?apercu=1) : les brouillons non publiés du back-office s'affichent à la place.
   Ce script les charge puis remplit la page : textes, line-up, billetterie, infos, replay, partenaires, ordre des blocs. */
(function () {
  'use strict';

  var FICHIERS = ['general', 'accueil', 'programmation', 'billetterie', 'infos', 'replay', 'partenaires'];
  var COULEURS = { orange: '#FF5500', jaune: '#F1FF00', vert: '#00FF97', rose: '#FC8AFD', bleu: '#00BFFF', marron: '#804240', noir: '#000000', creme: '#FFF8E6', blanc: '#FFFFFF' };
  var SCENES = { arena: { stage: 'SPEED ARENA', color: '#FF5500' }, boiler: { stage: 'BOILER VROOM', color: '#00FF97' } };

  /* ---------- Outils ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* Texte saisi dans le back-office : [[...]] = passage à compléter (surligné), retours à la ligne conservés */
  function txt(s) { return esc(s).replace(/\[\[(.+?)\]\]/g, '<span class="im-todo">$1</span>').replace(/\n/g, '<br>'); }
  function col(name, fallback) { return COULEURS[name] || (/^#[0-9a-f]{3,8}$/i.test(name || '') ? name : (fallback || '#FF5500')); }
  /* Les images envoyées par le back-office arrivent en « /assets/img/... » : on les rend relatives (le site vit dans un sous-dossier sur GitHub Pages) */
  function img(p) { return p ? String(p).replace(/^\/+/, '') : ''; }
  function get(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function $(id) { return document.getElementById(id); }
  /* Liens saisis dans le back-office : uniquement http(s), mailto, tel, ancres et chemins du site */
  function url(u) {
    u = String(u || '').trim();
    if (/^javascript:|^data:|^vbscript:/i.test(u)) return '';
    return /^(https?:\/\/|mailto:|tel:|#|\/|[\w.-]+(\/|\.html|$))/i.test(u) ? u : '';
  }
  var APERCU = /[?&]apercu=1(&|$)/.test(location.search);

  function charger() {
    return Promise.all(FICHIERS.map(function (f) {
      return fetch(APERCU ? 'admin/api.php?a=apercu&f=' + f : 'content/' + f + '.json', { cache: 'no-cache', credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(f + ' : ' + r.status); return r.json(); });
    })).then(function (list) {
      var d = {};
      FICHIERS.forEach(function (f, i) { d[f] = list[i]; });
      d.benevoles = (d.accueil.blocs || []).filter(function (b) { return b.type === 'benevoles'; })[0] || {};
      return d;
    });
  }

  /* ---------- Textes simples (attributs data-c / data-href / data-src) ---------- */
  function remplirTextes(d) {
    document.querySelectorAll('[data-c]').forEach(function (el) {
      var v = get(d, el.getAttribute('data-c'));
      if (typeof v === 'string' && v !== '') el.textContent = v;
    });
    document.querySelectorAll('[data-href]').forEach(function (el) {
      var v = get(d, el.getAttribute('data-href'));
      v = url(v);
      if (v) { el.href = v; if (/^https?:/.test(v)) { el.target = '_blank'; el.rel = 'noopener'; } }
    });
    document.querySelectorAll('[data-src]').forEach(function (el) {
      var v = get(d, el.getAttribute('data-src')); if (v) el.src = img(v);
    });
  }

  /* ---------- Compte à rebours : 0 = ouverture (heure de Paris) ---------- */
  function compteARebours(depart) {
    var iso = depart || '2026-08-28T18:00';
    if (!/[+-]\d\d:?\d\d$|Z$/.test(iso)) iso += (iso.length <= 16 ? ':00' : '') + '+02:00'; /* heure d'été de Paris */
    var cible = Date.parse(iso);
    function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
    function tick() {
      var left = Math.max(0, (cible || 0) - Date.now()), totalMin = Math.floor(left / 60000);
      $('cd-j').textContent = pad(Math.floor(totalMin / 1440), 3);
      $('cd-h').textContent = pad(Math.floor((totalMin % 1440) / 60), 2);
      $('cd-m').textContent = pad(totalMin % 60, 2);
    }
    tick(); setInterval(tick, 30000);
  }

  /* ---------- Ordre et visibilité des blocs de l'accueil ---------- */
  var SECTIONS = { 'compte-a-rebours': 'compte-a-rebours', programmation: 'grille', infos: 'infos', replay: 'replay', billetterie: 'billetterie', benevoles: 'benevoles', partenaires: 'partenaires' };
  function blocLibre(b) {
    var fond = col(b.fond, '#FFF8E6'), sombre = /^(noir|marron)$/.test(b.fond || '');
    var s = document.createElement('section');
    s.className = 'bloc-libre' + (sombre ? ' is-dark' : '') + (b.type === 'annonce' ? ' bloc-annonce' : '');
    s.style.background = fond;
    if (b.type === 'annonce') {
      s.innerHTML = '<div class="bl-in"><p class="t bl-annonce">' + txt(b.texte) + '</p>' +
        (b.bouton_texte ? '<a class="t bl-btn" href="' + esc(url(b.bouton_lien) || '#') + '">' + esc(b.bouton_texte) + '</a>' : '') + '</div>';
    } else {
      s.innerHTML = '<div class="bl-in' + (b.image ? ' has-img' : '') + '"><div class="bl-txt">' +
        (b.surtitre ? '<p class="bl-kicker">' + esc(b.surtitre) + '</p>' : '') +
        (b.titre ? '<h2 class="t bl-title">' + esc(b.titre) + '</h2>' : '') +
        (b.texte ? '<p class="bl-p">' + txt(b.texte) + '</p>' : '') +
        (b.bouton_texte ? '<a class="t bl-btn" href="' + esc(url(b.bouton_lien) || '#') + '">' + esc(b.bouton_texte) + '</a>' : '') +
        '</div>' + (b.image ? '<div class="bl-img"><img src="' + esc(img(b.image)) + '" alt="" class="ph"></div>' : '') + '</div>';
    }
    return s;
  }
  function ordonnerBlocs(blocs) {
    if (!blocs || !blocs.length) return;
    var footer = document.querySelector('footer'), parent = footer.parentNode, vus = {};
    Object.keys(SECTIONS).forEach(function (k) { var el = $(SECTIONS[k]); if (el) el.hidden = true; });
    blocs.forEach(function (b) {
      var id = SECTIONS[b.type], el;
      if (id) {
        if (vus[id] || !(el = $(id))) return;
        vus[id] = true;
        el.hidden = b.visible === false;
        parent.insertBefore(el, footer);
        var suite = document.querySelector('[data-suit="' + b.type + '"]');
        if (suite) { suite.hidden = el.hidden; parent.insertBefore(suite, footer); }
      } else if ((b.type === 'texte-libre' || b.type === 'annonce') && b.visible !== false) {
        parent.insertBefore(blocLibre(b), footer);
      }
    });
    /* Les rubriques masquées disparaissent aussi du menu */
    Object.keys(SECTIONS).forEach(function (k) {
      var el = $(SECTIONS[k]); if (!el || !el.hidden) return;
      var c = document.querySelector('[data-suit="' + k + '"]'); if (c) c.hidden = true;
      document.querySelectorAll('nav a[href="#' + SECTIONS[k] + '"]').forEach(function (a) { var li = a.closest('li'); if (li) li.hidden = true; });
    });
  }

  /* ---------- Grille de départ ---------- */
  var JOURS = {};
  function minutes(h) { var p = String(h || '0').toLowerCase().split(/[h:]/); var m = (+p[0] || 0) * 60 + (+p[1] || 0); return m < 12 * 60 ? m + 1440 : m; }
  var luScene = 'all';
  function heure(h) { return String(h || '').toUpperCase(); }
  function slot(a) {
    var sc = SCENES[a.scene] || SCENES.arena;
    return { name: a.nom, scene: SCENES[a.scene] ? a.scene : 'arena', stage: sc.stage, color: sc.color, t0: minutes(a.debut),
      start: heure(a.debut), end: heure(a.fin), time: (a.debut || '') + ' → ' + (a.fin || ''), info: a };
  }
  /* Une ligne par set : heure de début / fin, nom, pastille de scène. Séparateur « minuit » avant le premier set après 00h. */
  function ligne(day) { var minuit = false; return function (a, i) {
    if (luScene !== 'all' && a.scene !== luScene) return '';
    var sep = '';
    if (!minuit && a.t0 >= 1440) { minuit = true; sep = '<div class="t lu-mid" aria-hidden="true">MINUIT</div>'; }
    return '<li>' + sep + '<button type="button" class="lu-row" data-day="' + day + '" data-i="' + i + '" aria-haspopup="dialog" aria-label="' + esc(a.name + ', ' + a.time + ', ' + a.stage) + ' : voir la fiche artiste">' +
      '<span class="t lu-time"><b>' + esc(a.start) + '</b><span>' + esc(a.end) + '</span></span>' +
      '<span class="lu-who"><span class="t lu-name">' + esc(a.name) + '</span>' +
        '<span class="lu-stg" style="background:' + a.color + ';"><i></i>' + a.stage + '</span></span>' +
      '<span class="t lu-go" aria-hidden="true"><span class="lu-go-l">FICHE&#160;</span>→</span></button></li>';
  }; }
  function court(label, nom) { var m = String(label || '').match(/^\s*(\S{1,3})\S*\s+(\S+)/); return (m ? m[1] + ' ' + m[2] : label || '') + (nom ? ' · ' + nom : ''); }
  function luRender() {
    ['ven', 'sam'].forEach(function (day) { $(day + '-list').innerHTML = (JOURS[day] ? JOURS[day].list : []).map(ligne(day)).join(''); });
  }
  function luDay(day) {
    document.querySelector('.lu-days').setAttribute('data-day', day);
    document.querySelectorAll('.lu-tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-day') === day)); });
  }
  function grille(p) {
    ['ven', 'sam'].forEach(function (day) {
      var list = (p.artistes || []).filter(function (a) { return a.jour === day && a.nom && a.publie !== false; })
        .sort(function (x, y) { return minutes(x.debut) - minutes(y.debut); }).map(slot);
      JOURS[day] = { list: list, label: day === 'ven' ? p.vendredi : p.samedi };
      $('lu-tab-' + day).textContent = court(day === 'ven' ? p.vendredi : p.samedi, day === 'ven' ? p.vendredi_nom : p.samedi_nom);
    });
    luRender();
  }
  document.querySelectorAll('.lu-tab').forEach(function (t) {
    t.addEventListener('click', function () { luDay(t.getAttribute('data-day')); });
  });
  document.querySelectorAll('.lu-chip').forEach(function (c) {
    c.addEventListener('click', function () {
      luScene = c.getAttribute('data-scene');
      document.querySelectorAll('.lu-chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
      luRender();
    });
  });

  /* ---------- Popup fiche artiste ---------- */
  var am = $('artist-modal'), amOpener = null;
  function initials(name) { return name.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 3).toUpperCase(); }
  var PLAY = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#000"></circle><path d="M10 7.5v9l7-4.5z" fill="#fff"></path></svg>';
  function openArtist(dayKey, i, btn) {
    var a = JOURS[dayKey].list[i], info = a.info;
    amOpener = btn;
    am.style.setProperty('--am-color', a.color);
    $('am-kicker').textContent = '→ LINE-UP · ' + a.stage;
    $('am-name').textContent = a.name;
    $('am-day').textContent = JOURS[dayKey].label || '';
    $('am-time').textContent = a.time;
    $('am-stage').textContent = a.stage;
    $('am-bio').innerHTML = txt(info.bio || 'Présentation de l’artiste à venir.');
    $('am-photo').innerHTML = info.photo
      ? '<img src="' + esc(img(info.photo)) + '" alt="' + esc(a.name) + ', photo presse">'
      : '<div class="am-ph" aria-hidden="true"><span class="am-ph-init">' + esc(initials(a.name)) + '</span><span class="am-ph-note">PHOTO PRESSE À VENIR</span></div>';
    var listen = $('am-listen');
    if (info.sans_ecoute) listen.innerHTML = '';
    else if (url(info.ecoute)) listen.innerHTML = '<a class="am-listen-btn t" href="' + esc(url(info.ecoute)) + '" target="_blank" rel="noopener">' + PLAY + 'Écouter sur les plateformes <span aria-hidden="true">↗</span></a>';
    else listen.innerHTML = '<span class="am-listen-btn t is-soon" aria-disabled="true">' + PLAY + 'Écouter sur les plateformes</span><span class="am-soon">Lien d’écoute bientôt disponible</span>';
    am.hidden = false;
    document.body.style.overflow = 'hidden';
    $('am-close').focus();
  }
  function closeArtist() { am.hidden = true; document.body.style.overflow = ''; if (amOpener) amOpener.focus(); }
  $('grille').addEventListener('click', function (e) {
    var b = e.target.closest('.lu-row'); if (b) openArtist(b.getAttribute('data-day'), +b.getAttribute('data-i'), b);
  });
  $('am-close').addEventListener('click', closeArtist);
  am.addEventListener('click', function (e) { if (e.target === am) closeArtist(); });
  document.addEventListener('keydown', function (e) { if (!am.hidden && e.key === 'Escape') closeArtist(); });

  /* ---------- Billetterie ---------- */
  var STATUTS = { bientot: 'BIENTÔT', complet: 'COMPLET' };
  function billetterie(b) {
    var pass = b.pass || [], lienGen = b.lien || '#billetterie';
    function lien(p) { return url(p.lien) || url(lienGen) || '#billetterie'; }
    function ext(u) { return /^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''; }
    function prix(p) { return p.statut === 'complet' ? 'COMPLET' : (p.prix ? esc(p.prix) : (STATUTS[p.statut] || 'BIENTÔT')); }
    var vedettes = pass.filter(function (p) { return p.en_vedette; }), autres = pass.filter(function (p) { return !p.en_vedette; });
    var html = vedettes.map(function (p) {
      var c = col(p.couleur);
      return '<a class="pass' + (p.statut === 'complet' ? ' is-sold' : '') + '" href="' + esc(lien(p)) + '"' + ext(lien(p)) + ' style="text-decoration: none; color: #000; display: block; border: 4px solid #000; box-shadow: 0 0 0 7px ' + c + '; border-radius: 6px; background: ' + c + '; overflow: hidden;">' +
        '<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 4px 16px; padding: 14px 22px;"><span class="t plaque-u" style="font-size: clamp(36px, 4.4vw, 60px); font-weight: 900; font-style: italic; text-transform: uppercase;">' + esc(p.nom) + '</span><span class="t" style="font-size: clamp(30px, 3.4vw, 48px); font-weight: 900;">' + prix(p) + '</span></div>' +
        '<div class="bar" style="background: #000; color: ' + c + '; padding: 8px 22px; font-size: clamp(12px, 1.2vw, 15px);"><span>' + esc(p.bandeau) + '</span><span>★★★</span><span>' + esc(p.bandeau_droite) + '</span></div></a>';
    }).join('');
    if (autres.length) html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 26px;">' + autres.map(function (p) {
      var c = col(p.couleur);
      return '<a class="pass' + (p.statut === 'complet' ? ' is-sold' : '') + '" href="' + esc(lien(p)) + '"' + ext(lien(p)) + ' style="text-decoration: none; color: #000; display: block; border: 4px solid #000; box-shadow: 0 0 0 7px ' + c + '; border-radius: 6px; background: ' + c + '; overflow: hidden;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 18px;"><span class="t plaque-u" style="font-size: clamp(32px, 3vw, 40px); font-weight: 900; font-style: italic; text-transform: uppercase;">' + esc(p.nom) + '</span><span class="t" style="font-size: clamp(26px, 2.4vw, 32px); font-weight: 900;">' + prix(p) + '</span></div>' +
        '<div style="background: #000; color: ' + c + '; padding: 6px 18px; font-size: 14px;">' + esc(p.bandeau) + '</div></a>';
    }).join('') + '</div>';
    $('pass-list').innerHTML = html;
  }

  /* ---------- Replay + visionneuse ---------- */
  var FORMATS = { normal: '', large: 'span-c2', haut: 'span-r2', grand: 'span-c2 span-r2' };
  var PHOTOS = [], grid = $('replay-grid');
  function replay(r) {
    PHOTOS = (r.photos || []).filter(function (p) { return p.image; });
    grid.innerHTML = PHOTOS.map(function (p, i) {
      return '<button type="button" class="tile zoomable ' + (FORMATS[p.format] || '') + '" data-i="' + i + '" aria-label="Agrandir la photo : ' + esc(p.description) + '" style="padding:0;cursor:zoom-in;display:block;width:100%;height:100%;">' +
        '<img src="' + esc(img(p.image)) + '" alt="' + esc(p.description) + '" class="ph" loading="lazy">' +
        (p.etiquette ? '<span class="t" style="position:absolute;left:12px;bottom:10px;background:' + col(p.couleur) + ';color:#000;padding:2px 12px;font-size:clamp(18px,2vw,26px);font-weight:900;font-style:italic;">' + esc(p.etiquette) + '</span>' : '') +
        '<span aria-hidden="true" class="zoom-ico" style="position:absolute;right:10px;top:10px;width:38px;height:38px;border-radius:50%;background:#000;display:flex;align-items:center;justify-content:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M20 20l-4.8-4.8M10.5 7.5v6M7.5 10.5h6"></path></svg></span>' +
        '</button>';
    }).join('');
  }
  var lb = $('lightbox'), lbImg = $('lb-img'), lbAlt = $('lb-alt'), lbCount = $('lb-count'), cur = -1, opener = null;
  function show(i) {
    cur = (i + PHOTOS.length) % PHOTOS.length;
    lbImg.src = img(PHOTOS[cur].image); lbImg.alt = PHOTOS[cur].description || '';
    lbAlt.textContent = PHOTOS[cur].description || ''; lbCount.textContent = (cur + 1) + ' / ' + PHOTOS.length;
  }
  function open(i, btn) { opener = btn; show(i); lb.hidden = false; document.body.style.overflow = 'hidden'; $('lb-close').focus(); }
  function close() { lb.hidden = true; cur = -1; document.body.style.overflow = ''; if (opener) opener.focus(); }
  grid.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) open(+b.getAttribute('data-i'), b); });
  $('lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(cur - 1); });
  $('lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(cur + 1); });
  $('lb-close').addEventListener('click', function (e) { e.stopPropagation(); close(); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(cur - 1);
    else if (e.key === 'ArrowRight') show(cur + 1);
  });

  /* ---------- Briefing pilotes : cartes + popups ---------- */
  function picto(c) {
    var fill = col(c.couleur), t = esc(c.texte_pictogramme || '');
    switch (c.pictogramme) {
      case 'triangle': return '<svg viewBox="0 0 120 104" width="70" height="61" aria-hidden="true" style="position: absolute; right: 10px; bottom: -30px;"><polygon points="60,6 114,98 6,98" fill="' + fill + '" stroke="#000" stroke-width="7" stroke-linejoin="round"></polygon><text x="60" y="84" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-style="italic" font-size="44">' + t + '</text></svg>';
      case 'hexagone': return '<svg viewBox="0 0 120 104" width="70" height="61" aria-hidden="true" style="position: absolute; right: 10px; bottom: -30px;"><polygon points="32,4 88,4 116,52 88,100 32,100 4,52" fill="' + fill + '" stroke="#000" stroke-width="7" stroke-linejoin="round"></polygon><text x="60" y="68" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-size="46">' + t + '</text></svg>';
      case 'tente': return '<svg viewBox="0 0 104 104" width="62" height="62" aria-hidden="true" style="position: absolute; right: 12px; bottom: -30px;"><circle cx="52" cy="52" r="46" fill="' + fill + '" stroke="#000" stroke-width="7"></circle><path d="M24 72 L52 30 L80 72 Z" fill="none" stroke="#000" stroke-width="6" stroke-linejoin="round"></path><path d="M52 30 V72" stroke="#000" stroke-width="5"></path></svg>';
      case 'interdit': return '<svg viewBox="0 0 104 104" width="62" height="62" aria-hidden="true" style="position: absolute; right: 12px; bottom: -30px;"><circle cx="52" cy="52" r="46" fill="' + fill + '" stroke="#000" stroke-width="7"></circle><path d="M20 20 L84 84" stroke="#000" stroke-width="7"></path></svg>';
      default: return t ? '<svg viewBox="0 0 104 104" width="62" height="62" aria-hidden="true" style="position: absolute; right: 12px; bottom: -30px;"><circle cx="52" cy="52" r="46" fill="' + fill + '" stroke="#000" stroke-width="7"></circle><text x="52" y="66" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-size="40">' + t + '</text></svg>' : '';
    }
  }
  var CARTES = [];
  function infos(inf) {
    CARTES = inf.cartes || [];
    $('info-cards').innerHTML = CARTES.map(function (c, i) {
      return '<a href="#infos" class="info-card" data-i="' + i + '" aria-haspopup="dialog" style="text-decoration: none; color: #000; background: #fff; border: 4px solid #000; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column;">' +
        '<div style="position: relative; height: 170px; border-bottom: 4px solid #000;">' + (c.photo ? '<img src="' + esc(img(c.photo)) + '" alt="" class="ph">' : '<div class="dots" style="position:absolute;inset:0;opacity:.3;"></div>') + picto(c) + '</div>' +
        '<div style="padding: 20px; display: flex; flex-direction: column; gap: 8px;"><span class="t" style="font-size: clamp(28px, 2.6vw, 34px); font-weight: 900; text-transform: uppercase; line-height: .95;">' + esc(c.titre) + '</span><span style="font-size: 15px; line-height: 1.5;">' + txt(c.resume) + '</span><span class="info-more t">En savoir plus →</span></div></a>';
    }).join('');
  }
  var NO = '<svg viewBox="0 0 110 110" width="64" height="64" aria-hidden="true"><circle cx="55" cy="55" r="50" fill="#00FF97" stroke="#000" stroke-width="7"></circle><path d="M20 20 L90 90" stroke="#000" stroke-width="7"></path></svg>';
  function corpsPopup(c) {
    var h = '';
    if (c.intro) h += '<p class="im-v" style="margin:0;">' + txt(c.intro) + '</p>';
    if (c.horaires && c.horaires.length) {
      h += '<table class="im-sched"><thead><tr><th>Jour</th><th>Ouverture</th><th>Premier départ</th><th>Fermeture</th></tr></thead><tbody>' +
        c.horaires.map(function (r) {
          return '<tr><td>' + esc(r.jour) + '</td><td data-l="Ouverture">' + esc(r.ouverture) + '</td><td data-l="Premier départ">' + esc(r.premier_depart) + '</td><td data-l="Fermeture">' + esc(r.fermeture) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    (c.lignes || []).forEach(function (r) { h += '<div class="im-row"><span class="im-k">' + esc(r.titre) + '</span><div class="im-v">' + txt(r.texte) + '</div></div>'; });
    if (c.interdits && c.interdits.length) h += '<div class="im-ban">' + c.interdits.map(function (t) { return '<div>' + NO + '<span>' + esc(t) + '</span></div>'; }).join('') + '</div>';
    if (c.bouton_texte && url(c.bouton_lien)) {
      var interne = c.bouton_lien.charAt(0) === '#';
      h += '<div class="im-actions"><a class="im-btn' + (interne ? ' im-go' : '') + '" href="' + esc(url(c.bouton_lien)) + '"' + (interne ? '' : ' target="_blank" rel="noopener"') + '>' + esc(c.bouton_texte) + '</a></div>';
    }
    return h;
  }
  var im = $('info-modal'), imOpener = null;
  function openInfo(i, opener) {
    var c = CARTES[i]; if (!c) return;
    imOpener = opener;
    im.style.setProperty('--am-color', col(c.couleur));
    $('im-title').textContent = c.titre;
    $('im-photo').innerHTML = c.photo ? '<img src="' + esc(img(c.photo)) + '" alt="">' : '';
    $('im-body').innerHTML = corpsPopup(c);
    im.hidden = false;
    document.body.style.overflow = 'hidden';
    $('im-close').focus();
  }
  function closeInfo(restore) { im.hidden = true; document.body.style.overflow = ''; if (restore !== false && imOpener) imOpener.focus(); }
  $('info-cards').addEventListener('click', function (e) {
    var c = e.target.closest('.info-card'); if (!c) return;
    e.preventDefault(); openInfo(+c.getAttribute('data-i'), c);
  });
  $('im-close').addEventListener('click', function () { closeInfo(); });
  im.addEventListener('click', function (e) {
    if (e.target === im) closeInfo();
    var go = e.target.closest('.im-go'); if (go) closeInfo(false); /* lien interne : on ferme et on laisse défiler */
  });
  document.addEventListener('keydown', function (e) { if (!im.hidden && e.key === 'Escape') closeInfo(); });

  /* ---------- Partenaires ---------- */
  function partenaires(p) {
    var logos = (p.logos || []).filter(function (l) { return l.logo || l.nom; });
    if (logos.length) {
      $('logos').innerHTML = logos.map(function (l) {
        var inner = l.logo ? '<img src="' + esc(img(l.logo)) + '" alt="' + esc(l.nom || 'Partenaire') + '">' : '<span>' + esc(l.nom) + '</span>';
        return url(l.lien) ? '<a class="logo-cell" href="' + esc(url(l.lien)) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<div class="logo-cell">' + inner + '</div>';
      }).join('');
    }
    var mail = $('partner-mail');
    if (p.email) mail.href = 'mailto:' + p.email; else mail.href = '#partenaires';
  }

  /* Le menu mobile se referme après un clic sur une rubrique */
  document.querySelectorAll('.nav-drop a').forEach(function (a) {
    a.addEventListener('click', function () { var d = document.querySelector('.nav-burger'); if (d) d.open = false; });
  });

  /* ---------- Lancement ---------- */
  charger().then(function (d) {
    remplirTextes(d);
    compteARebours(d.general.depart);
    ordonnerBlocs(d.accueil.blocs);
    grille(d.programmation);
    billetterie(d.billetterie);
    replay(d.replay);
    infos(d.infos);
    partenaires(d.partenaires);
    document.documentElement.classList.add('contenus-ok');
    if (APERCU) {
      var ban = document.createElement('div');
      ban.className = 'apercu-ban';
      ban.innerHTML = 'APERÇU · modifications non publiées <a href="admin/">Retour au back-office</a>';
      document.body.appendChild(ban);
    }
    try { var t = location.hash && document.querySelector(location.hash); if (t) t.scrollIntoView(); } catch (e) {}
  }).catch(function (err) {
    console.error('Speed : contenus non chargés', err);
    compteARebours();
  });
})();
