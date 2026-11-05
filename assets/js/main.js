/* Speed Festival — scripts du site (grille 2027, replay + visionneuse, compte à rebours) */
(function () {
  'use strict';

  /* ---------- Compte à rebours : 0 = ouverture du vendredi 18h (heure de Paris) ---------- */
  var DEPART = '2026-08-28T18:00:00+02:00';
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function tick() {
    var left = Math.max(0, Date.parse(DEPART) - Date.now());
    var totalMin = Math.floor(left / 60000);
    document.getElementById('cd-j').textContent = pad(Math.floor(totalMin / 1440), 3);
    document.getElementById('cd-h').textContent = pad(Math.floor((totalMin % 1440) / 60), 2);
    document.getElementById('cd-m').textContent = pad(totalMin % 60, 2);
  }
  tick();
  setInterval(tick, 30000);

  /* ---------- Grille de départ 2027 ---------- */
  var SA = { stage: 'SPEED ARENA', color: '#FF5500' };
  var BV = { stage: 'BOILER VROOM', color: '#00FF97' };
  var ALL = { stage: 'SPEED ARENA', color: '#FF5500' };
  function slot(name, sc, from, to) {
    var p = from.split('h');
    return { name: name, stage: sc.stage, color: sc.color, h: p[0] + 'H', m: p[1] || '00', time: from + ' → ' + to,
      size: name.length > 14 ? 'clamp(26px, 2.6vw, 36px)' : 'clamp(32px, 3.4vw, 46px)' };
  }

  /* ---------- Fiches artistes ----------
     Pour chaque artiste : photo (chemin d'image, sinon visuel provisoire), bio,
     et liens d'écoute. Tant qu'un lien officiel n'est pas renseigné, le bouton
     ouvre une recherche du nom sur la plateforme.
     Remplacer les textes marqués « à valider » / « à venir » par les vrais. */
  var ARTISTES = {
    'Tremplin': { bio: 'Le lauréat du tremplin Speed ouvre le circuit : un talent local repéré par l’équipe, qui prend la pole avant tout le monde. Nom dévoilé bientôt.', noLinks: true },
    'DJ Stiff': { bio: 'Présentation de l’artiste à venir.' },
    'Europe': { bio: 'Présentation de l’artiste à venir.' },
    'Notinbed': { bio: 'Présentation de l’artiste à venir.' },
    'St Graal': { bio: 'Artiste français révélé en 2021 par le titre viral « Les dauphins », entre électro et pop aérienne. (Texte à valider)' },
    'Noel Minitel': { bio: 'Présentation de l’artiste à venir.' },
    'Benwal': { bio: 'DJ et producteur néerlandais originaire de Groningue : des sets trance, hard house et techno à très haute énergie, passés par Pukkelpop et les grands clubs européens. (Texte à valider)' },
    'Sheriff': { bio: 'Présentation de l’artiste à venir.' },
    'Velvet Brothers': { bio: 'Présentation de l’artiste à venir.' },
    'DJ Minou': { bio: 'Présentation de l’artiste à venir.' },
    'Arone': { bio: 'Présentation de l’artiste à venir.' },
    'Solar Boys': { bio: 'Présentation de l’artiste à venir.' },
    'Camoufly': { bio: 'Producteur et DJ masqué venu d’Italie : house, UK garage et sons expérimentaux, un mélange de genres qui ne tient jamais en place. (Texte à valider)' },
    'Snoritz': { bio: 'DJ et producteur de Münster : du garage à la hard house en passant par les breaks, des sets qui accélèrent sans prévenir. (Texte à valider)' },
    'Speed All Stars End Show': { bio: 'Le grand final du Speed : toute l’écurie monte sur la Speed Arena pour le dernier tour de piste. Programme surprise.', noLinks: true }
  };
  /* Écoute : un seul lien « magic link » par artiste (page qui laisse choisir sa plateforme :
     Spotify, Deezer, Apple Music…). À renseigner dans ARTISTES[nom].listen = 'https://…'.
     Sans lien, le bouton s'affiche en « bientôt disponible ». */
  var VEN = [
    slot('Tremplin', BV, '19h00', '19h30'),
    slot('DJ Stiff', BV, '19h30', '20h30'),
    slot('Europe', SA, '21h30', '22h30'),
    slot('Notinbed', BV, '22h30', '23h30'),
    slot('St Graal', SA, '23h30', '00h30'),
    slot('Noel Minitel', BV, '00h30', '01h30'),
    slot('Benwal', SA, '01h30', '02h50')
  ];
  var SAM = [
    slot('Sheriff', BV, '19h00', '19h55'),
    slot('Velvet Brothers', SA, '20h00', '21h00'),
    slot('DJ Minou', BV, '21h00', '21h55'),
    slot('Arone', SA, '22h00', '22h50'),
    slot('Solar Boys', BV, '23h00', '23h55'),
    slot('Camoufly', SA, '00h00', '01h00'),
    slot('Snoritz', SA, '01h00', '02h00'),
    slot('Speed All Stars End Show', ALL, '02h00', '02h45')
  ];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plaque(day) { return function (a, i) {
    return '<button type="button" class="artist-btn' + (i % 2 ? ' stg' : '') + '" data-day="' + day + '" data-i="' + i + '" aria-haspopup="dialog" aria-label="' + esc(a.name) + ' : voir la fiche artiste">' +
      '<div style="display:flex;align-items:stretch;border:4px solid #000;box-shadow:0 0 0 6px ' + a.color + ';border-radius:6px;background:' + a.color + ';overflow:hidden;">' +
      '<div class="t" style="width:clamp(78px,8vw,104px);flex:none;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 4px;line-height:.9;">' +
        '<span style="font-size:clamp(30px,3vw,40px);font-weight:900;font-style:italic;">' + a.h + '</span>' +
        '<span style="font-size:clamp(18px,1.8vw,22px);font-weight:800;color:' + a.color + ';">' + a.m + '</span></div>' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;">' +
        '<div class="t plaque-u" style="flex:1;display:flex;align-items:center;justify-content:center;text-align:center;font-size:' + a.size + ';line-height:1;font-weight:900;font-style:italic;text-transform:uppercase;padding:14px 10px 16px;">' + esc(a.name) + '</div>' +
        '<div class="bar" style="background:#000;color:' + a.color + ';padding:6px 14px;font-size:clamp(12px,1.2vw,15px);font-weight:600;"><span>→ ' + a.stage + '</span><span class="am-hint">+ FICHE ARTISTE</span><span>' + a.time + '</span></div>' +
      '</div></div></button>';
  }; }
  var JOURS = { ven: { list: VEN, label: 'Vendredi 28' }, sam: { list: SAM, label: 'Samedi 29' } };
  document.getElementById('ven-list').innerHTML = VEN.map(plaque('ven')).join('');
  document.getElementById('sam-list').innerHTML = SAM.map(plaque('sam')).join('');

  /* ---------- Popup fiche artiste ---------- */
  var am = document.getElementById('artist-modal'), amOpener = null;
  function initials(name) { return name.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 3).toUpperCase(); }
  function openArtist(dayKey, i, btn) {
    var a = JOURS[dayKey].list[i], info = ARTISTES[a.name] || {};
    amOpener = btn;
    am.style.setProperty('--am-color', a.color);
    document.getElementById('am-kicker').textContent = '→ LINE-UP 2027 · ' + a.stage;
    document.getElementById('am-name').textContent = a.name;
    document.getElementById('am-day').textContent = JOURS[dayKey].label;
    document.getElementById('am-time').textContent = a.time;
    document.getElementById('am-stage').textContent = a.stage;
    document.getElementById('am-bio').textContent = info.bio || 'Présentation de l’artiste à venir.';
    var photo = document.getElementById('am-photo');
    photo.innerHTML = info.photo
      ? '<img src="' + esc(info.photo) + '" alt="' + esc(a.name) + ', photo presse">'
      : '<div class="am-ph" aria-hidden="true"><span class="am-ph-init">' + esc(initials(a.name)) + '</span><span class="am-ph-note">PHOTO PRESSE À VENIR</span></div>';
    var listen = document.getElementById('am-listen');
    if (info.noLinks) { listen.innerHTML = ''; }
    else if (info.listen) {
      listen.innerHTML = '<a class="am-listen-btn t" href="' + esc(info.listen) + '" target="_blank" rel="noopener">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#000"></circle><path d="M10 7.5v9l7-4.5z" fill="#fff"></path></svg>' +
        'Écouter sur les plateformes <span aria-hidden="true">↗</span></a>';
    } else {
      listen.innerHTML = '<span class="am-listen-btn t is-soon" aria-disabled="true">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#000"></circle><path d="M10 7.5v9l7-4.5z" fill="#fff"></path></svg>' +
        'Écouter sur les plateformes</span><span class="am-soon">Lien d’écoute bientôt disponible</span>';
    }
    am.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('am-close').focus();
  }
  function closeArtist() { am.hidden = true; document.body.style.overflow = ''; if (amOpener) amOpener.focus(); }
  document.getElementById('grille').addEventListener('click', function (e) {
    var b = e.target.closest('.artist-btn'); if (b) openArtist(b.getAttribute('data-day'), +b.getAttribute('data-i'), b);
  });
  document.getElementById('am-close').addEventListener('click', closeArtist);
  am.addEventListener('click', function (e) { if (e.target === am) closeArtist(); });
  document.addEventListener('keydown', function (e) { if (!am.hidden && e.key === 'Escape') closeArtist(); });

  /* ---------- Replay 2025 + visionneuse ---------- */
  var PHOTOS = [
    { src: 'assets/img/p723.jpg', alt: 'Drapeau à damier brandi au-dessus de la foule devant la scène', cls: 'span-c2 span-r2', label: 'DRAPEAU À DAMIER', bg: '#FF5500' },
    { src: 'assets/img/p166.jpg', alt: 'La scène Boiler Vroom montée sur une voiture rose', cls: '' },
    { src: 'assets/img/p373.jpg', alt: 'Gobelets Speed remplis de bière', cls: '' },
    { src: 'assets/img/p090.jpg', alt: 'Bande de potes au camping en combinaisons orange', cls: 'span-c2', label: 'LE PADDOCK', bg: '#00FF97' },
    { src: 'assets/img/p255.jpg', alt: 'Bénévole au bar en t-shirt rose servant un pichet', cls: '' },
    { src: 'assets/img/p448.jpg', alt: 'Foule devant la scène avec des étincelles', cls: 'span-r2' },
    { src: 'assets/img/p159.jpg', alt: 'Festivaliers qui dansent en plein jour', cls: '' },
    { src: 'assets/img/p655.jpg', alt: 'Festivaliers en lunettes de soleil', cls: '' },
    { src: 'assets/img/p471.jpg', alt: 'Festivalière en veste Racing', cls: '' }
  ];
  var grid = document.getElementById('replay-grid');
  grid.innerHTML = PHOTOS.map(function (p, i) {
    return '<button type="button" class="tile zoomable ' + p.cls + '" data-i="' + i + '" aria-label="Agrandir la photo : ' + esc(p.alt) + '" style="padding:0;cursor:zoom-in;display:block;width:100%;height:100%;">' +
      '<img src="' + p.src + '" alt="' + esc(p.alt) + '" class="ph" loading="lazy">' +
      (p.label ? '<span class="t" style="position:absolute;left:12px;bottom:10px;background:' + p.bg + ';color:#000;padding:2px 12px;font-size:clamp(18px,2vw,26px);font-weight:900;font-style:italic;">' + p.label + '</span>' : '') +
      '<span aria-hidden="true" class="zoom-ico" style="position:absolute;right:10px;top:10px;width:38px;height:38px;border-radius:50%;background:#000;display:flex;align-items:center;justify-content:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M20 20l-4.8-4.8M10.5 7.5v6M7.5 10.5h6"></path></svg></span>' +
      '</button>';
  }).join('');

  var lb = document.getElementById('lightbox'), lbImg = document.getElementById('lb-img'),
      lbAlt = document.getElementById('lb-alt'), lbCount = document.getElementById('lb-count'), cur = -1, opener = null;
  function show(i) {
    cur = (i + PHOTOS.length) % PHOTOS.length;
    lbImg.src = PHOTOS[cur].src; lbImg.alt = PHOTOS[cur].alt;
    lbAlt.textContent = PHOTOS[cur].alt; lbCount.textContent = (cur + 1) + ' / ' + PHOTOS.length;
  }
  function open(i, btn) { opener = btn; show(i); lb.hidden = false; document.body.style.overflow = 'hidden'; document.getElementById('lb-close').focus(); }
  function close() { lb.hidden = true; cur = -1; document.body.style.overflow = ''; if (opener) opener.focus(); }
  grid.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) open(+b.getAttribute('data-i'), b); });
  document.getElementById('lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(cur - 1); });
  document.getElementById('lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(cur + 1); });
  document.getElementById('lb-close').addEventListener('click', function (e) { e.stopPropagation(); close(); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(cur - 1);
    else if (e.key === 'ArrowRight') show(cur + 1);
  });

  /* Le menu mobile se referme après un clic sur une rubrique */
  document.querySelectorAll('.nav-drop a').forEach(function (a) {
    a.addEventListener('click', function () { var d = document.querySelector('.nav-burger'); if (d) d.open = false; });
  });
})();
