/*
 * Module PowerPoint Live — version pour les anciens PowerPoint (2016, 2019), dont le moteur
 * (Internet Explorer 11 ou Edge ancien) ne fait pas tourner l'application moderne.
 * JavaScript ES5 volontairement : pas de let/const, de flèches, de Promise ni de fetch.
 *
 * Même comportement que src/pages/Addin.tsx :
 *  - le module garde dans le fichier { url: adresse de la diapo Live, slideId: diapo PowerPoint } ;
 *  - mode Normal : aperçu, rien ne bouge dans la salle ;
 *  - diaporama : quand SA diapo est à l'écran, la salle passe à l'activité ;
 *  - affichage : accueil (QR code), sondage / quiz (barres), nuage de mots (liste), questions du public.
 * Test hors PowerPoint : legacy.html?url=<adresse d'une diapo Live> (diapo considérée à l'écran).
 */
;(function () {
  var W = 1280
  var H = 720
  var COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#14b8a6', '#f97316']
  var SETTING = 'live'

  var office = null // Office.context.document, ou null hors PowerPoint
  var saved = null // { url, slideId }
  var target = null // { code, slide, key }
  var view = 'edit'
  var current = false
  var wasCurrent = false
  var session = null
  var answers = []
  var participants = []
  var questions = []
  var host = location.host
  var started = false
  var answersFor = null

  // ---------- utilitaires ----------
  function $(id) {
    return document.getElementById(id)
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
  function rand(n) {
    var c = 'abcdefghijklmnopqrstuvwxyz0123456789'
    var s = ''
    for (var i = 0; i < n; i++) s += c.charAt(Math.floor(Math.random() * c.length))
    return s
  }
  var uid = (function () {
    try {
      var u = localStorage.getItem('live-app-uid')
      if (!u) {
        u = rand(20)
        localStorage.setItem('live-app-uid', u)
      }
      return u
    } catch (e) {
      return rand(20)
    }
  })()
  function parse(url) {
    var m = /\/ppt\/(\d{6})\/([\w-]+)\?(?:.*&)?k=([^&#]+)/.exec(String(url || ''))
    return m ? { code: m[1], slide: m[2], key: decodeURIComponent(m[3]) } : null
  }
  function api(method, url, body, cb) {
    var x = new XMLHttpRequest()
    // anti-cache : Internet Explorer garde les réponses GET en mémoire
    var u = method === 'GET' ? url + (url.indexOf('?') < 0 ? '?' : '&') + '_=' + new Date().getTime() : url
    x.open(method, u, true)
    x.setRequestHeader('x-uid', uid)
    if (target) x.setRequestHeader('x-key', target.key)
    if (body) x.setRequestHeader('content-type', 'application/json')
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return
      var data = null
      try {
        data = JSON.parse(x.responseText)
      } catch (e) {}
      if (cb) cb(x.status, data)
    }
    x.send(body ? JSON.stringify(body) : null)
  }
  function S() {
    return '/api/sessions/' + target.code
  }

  // ---------- mise à l'échelle 16:9 ----------
  var lastSize = ''
  function fit() {
    var w = document.documentElement.clientWidth || window.innerWidth
    var h = document.documentElement.clientHeight || window.innerHeight
    if (!w || !h || w + 'x' + h === lastSize) return
    lastSize = w + 'x' + h
    var s = Math.min(w / W, h / H)
    var t = 'translate(' + (w - W * s) / 2 + 'px,' + (h - H * s) / 2 + 'px) scale(' + s + ')'
    var el = $('fit').style
    el.transform = t
    el.msTransform = t
    el.webkitTransform = t
  }

  // ---------- ce que montre la diapo ----------
  // La diapo affiche tout de suite SON activité, sans attendre que la salle ait suivi :
  // sinon l'activité précédente reste visible une seconde au changement de diapo.
  function targetItem(s) {
    for (var i = 0; i < s.items.length; i++) if (s.items[i].id === target.slide) return s.items[i]
    return null
  }
  function copy(s, patch) {
    var o = {}
    var k
    for (k in s) if (s.hasOwnProperty(k)) o[k] = s[k]
    for (k in patch) if (patch.hasOwnProperty(k)) o[k] = patch[k]
    return o
  }
  function slideView(s) {
    if (target.slide === 'accueil') return s.status === 'lobby' ? s : copy(s, { status: 'lobby', currentIndex: -1, phase: 'question' })
    if (target.slide === 'fin') return s.status === 'ended' ? s : copy(s, { status: 'ended', phase: 'leaderboard' })
    var index = -1
    for (var i = 0; i < s.items.length; i++) if (s.items[i].id === target.slide) index = i
    if (index < 0 || (s.status === 'active' && s.currentIndex === index)) return s
    return copy(s, { status: 'active', currentIndex: index, phase: 'question', timerEndsAt: null })
  }

  // adresse du site masquée à l'écran tant que c'est sondage.baratextile.com (QR code et code seulement)
  function shownHost() {
    return /baratextile/i.test(host) ? null : host
  }

  // ---------- affichage ----------
  function badge() {
    return (
      '<div class="badge"><img src="/api/qr.svg?code=' + target.code + '" alt="" />' +
      (shownHost() ? esc(shownHost()) : 'Code') + '<br><b>' + target.code + '</b></div>'
    )
  }
  function bars(item, highlight) {
    var counts = []
    var i
    for (i = 0; i < item.options.length; i++) counts.push(0)
    for (i = 0; i < answers.length; i++) {
      var v = answers[i].value || []
      for (var j = 0; j < v.length; j++) if (counts[v[j]] !== undefined) counts[v[j]]++
    }
    var max = 1
    for (i = 0; i < counts.length; i++) if (counts[i] > max) max = counts[i]
    var total = answers.length
    var html = '<div class="' + (item.options.length > 6 ? 'compact' : '') + '">'
    for (i = 0; i < item.options.length; i++) {
      var c = COLORS[i % COLORS.length]
      var dim = highlight !== undefined && highlight !== i ? ' style="opacity:0.45"' : ''
      html +=
        '<div class="row"' + dim + '><div class="lab"><span class="sw" style="background:' + c + '"></span>' +
        esc(item.options[i]) + (highlight === i ? ' ✓' : '') +
        '<span class="pct">' + counts[i] + ' · ' + (total ? Math.round((counts[i] / total) * 100) : 0) + '%</span></div>' +
        '<div class="track"><div class="fill" style="width:' + (counts[i] / max) * 100 + '%;background:' + c + '"></div></div></div>'
    }
    return html + '</div>'
  }
  function cloud() {
    var map = {}
    var list = []
    for (var i = 0; i < answers.length; i++) {
      var v = answers[i].value || []
      for (var j = 0; j < v.length; j++) {
        var w = String(v[j]).replace(/^\s+|\s+$/g, '').toLowerCase()
        if (!w) continue
        if (!map[w]) {
          map[w] = { text: w, count: 0 }
          list.push(map[w])
        }
        map[w].count++
      }
    }
    list.sort(function (a, b) {
      return b.count - a.count
    })
    list = list.slice(0, 40)
    var max = list.length ? list[0].count : 1
    var html = '<div class="cloud">'
    for (var k = 0; k < list.length; k++) {
      var size = Math.round(24 + (list[k].count / max) * 56)
      html += '<span style="font-size:' + size + 'px;color:' + COLORS[k % COLORS.length] + '">' + esc(list[k].text) + '</span>'
    }
    if (!list.length) html += '<div class="muted" style="font-size:28px;padding-top:120px">En attente des premiers mots…</div>'
    return html + '</div>'
  }
  // Ne touche à l'écran que si le contenu a changé : redessiner (et redécoder le QR code)
  // chaque seconde fait geler le vieux moteur d'Internet Explorer.
  var lastHtml = null
  function paint(html) {
    if (html === lastHtml) return
    lastHtml = html
    $('stage').innerHTML = html
  }
  function render() {
    var st = { innerHTML: '' }
    if (!session) {
      return paint('<div class="center muted">Live…</div>')
    }
    var s = slideView(session)
    if (s.status === 'lobby') {
      var names = ''
      var shown = participants.slice(-24)
      for (var i = 0; i < shown.length; i++) names += esc(shown[i].name) + (i < shown.length - 1 ? ' · ' : '')
      var how =
        (shownHost()
          ? 'Rendez-vous sur <b>' + esc(shownHost()) + '</b><br>et entrez le code'
          : 'Scannez le QR code<br><span class="muted" style="font-size:22px">avec l’appareil photo du téléphone · code de la salle :</span>') +
        '<div class="code">' + target.code + '</div>' +
        '<div class="muted" style="font-size:22px">' + participants.length + ' participant' + (participants.length > 1 ? 's' : '') + ' dans la salle</div>' +
        '<div class="muted" style="font-size:16px;margin-top:10px">' + names + '</div>'
      // l'accueil est déjà affiché : on ne met à jour que le texte, le QR code reste en place
      var shell = 'lobby:' + target.code + ':' + s.title
      if (lastHtml === shell && $('how')) {
        if ($('how').innerHTML !== how) $('how').innerHTML = how
        return
      }
      paint(
        '<div class="lobby"><div class="head"><h1>' + esc(s.title) + '</h1></div>' +
          '<div class="how" id="how">' + how + '</div>' +
          '<div class="qr"><img src="/api/qr.svg?code=' + target.code + '" alt="QR code" /></div></div>'
      )
      lastHtml = shell
      return
    }
    if (s.status === 'ended') {
      st.innerHTML =
        '<div class="center">Merci ! 🙏<div class="muted" style="font-size:24px;margin-top:20px">' + esc(s.title) + ' · ' +
        participants.length + ' participant' + (participants.length > 1 ? 's' : '') + '</div></div>'
      return paint(st.innerHTML)
    }
    var item = s.items[s.currentIndex]
    if (!item) return paint('')
    var body = ''
    var foot = ''
    if (s.phase === 'leaderboard') {
      var ranked = participants.slice().sort(function (a, b) {
        return b.score - a.score
      })
      for (var r = 0; r < Math.min(8, ranked.length); r++)
        body += '<div class="qa"><div><b>' + (r + 1) + '</b>' + esc(ranked[r].name) + ' · ' + ranked[r].score + ' pts</div></div>'
    } else if (item.type === 'poll') {
      body = bars(item)
      foot = answers.length + ' réponse' + (answers.length > 1 ? 's' : '')
    } else if (item.type === 'quiz') {
      body = s.phase === 'results' ? bars(item, item.correctIndex) : bars(item)
      foot = answers.length + ' / ' + participants.length + ' réponses'
    } else if (item.type === 'wordcloud') {
      body = cloud()
      foot = answers.length + ' participant' + (answers.length > 1 ? 's ont' : ' a') + ' répondu'
    } else if (item.type === 'qa') {
      body = '<div class="muted" style="font-size:22px;margin-bottom:12px">' + esc(item.prompt) + '</div><div class="qa">'
      var shownQ = 0
      for (var q = 0; q < questions.length && shownQ < 8; q++) {
        if (questions[q].hidden) continue
        body += '<div><b>▲ ' + questions[q].votes + '</b>' + esc(questions[q].text) + '</div>'
        shownQ++
      }
      body += '</div>'
    }
    st.innerHTML =
      '<div class="head"><h1>' + esc(s.phase === 'leaderboard' ? '🏆 Classement' : item.title) + '</h1>' + badge() + '</div>' +
      '<div class="body">' + body + '</div><div class="foot">' + foot + '</div>'
    paint(st.innerHTML)
  }
  function renderBar() {
    var b = $('bar')
    if (view === 'read' || !office) {
      b.innerHTML = ''
      return
    }
    b.innerHTML = '<span>Aperçu Live (PowerPoint ancien) · la salle passera à cette activité en diaporama</span>' +
      '<a href="#" id="change">Changer l’adresse</a>'
    $('change').onclick = function () {
      setup(saved ? saved.url : '')
      return false
    }
  }

  // ---------- réglage de l'adresse (première pose du module) ----------
  function setup(value, error) {
    $('fit').style.display = 'none'
    $('bar').innerHTML =
      '<div class="setup" style="background:#0b1020"><b style="font-size:22px">Live</b><br>' +
      'Collez l’adresse de cette diapo, copiée depuis la page PowerPoint de votre présentation sur le site Live.<br>' +
      '<input id="url" value="' + esc(value || '') + '" placeholder="https://…/ppt/…" />' +
      (error ? '<div class="err">' + esc(error) + '</div>' : '') +
      '<button id="ok">Valider</button></div>'
    $('ok').onclick = function () {
      var url = $('url').value
      if (!parse(url)) return setup(url, 'Adresse non reconnue.')
      var finish = function (slideId) {
        saved = { url: url, slideId: slideId }
        office.settings.set(SETTING, saved)
        office.settings.saveAsync(function () {
          $('fit').style.display = ''
          startWith(saved)
        })
      }
      office.getSelectedDataAsync(Office.CoercionType.SlideRange, function (r) {
        finish(r.status === 'succeeded' && r.value && r.value.slides && r.value.slides[0] ? r.value.slides[0].id : undefined)
      })
    }
  }

  // ---------- la salle suit les diapos ----------
  function sync() {
    var s = session
    if (!s || !target) return
    var index = -1
    for (var i = 0; i < s.items.length; i++) if (s.items[i].id === target.slide) index = i
    var patch = null
    if (target.slide === 'fin') {
      if (s.status !== 'ended') patch = { status: 'ended', phase: 'leaderboard' }
    } else if (target.slide === 'accueil') {
      if (s.status !== 'lobby') patch = { status: 'lobby', currentIndex: -1, phase: 'question', questionStartedAt: null, timerEndsAt: null }
    } else if (index >= 0 && (s.status !== 'active' || s.currentIndex !== index)) {
      patch = {
        status: 'active',
        currentIndex: index,
        phase: 'question',
        questionStartedAt: s.items[index].type === 'quiz' ? null : new Date().getTime(),
        timerEndsAt: null,
      }
    }
    if (patch) api('PATCH', S(), patch, function () {})
  }
  function watchSlide() {
    if (!office || view !== 'read' || !saved) {
      current = !office // hors PowerPoint (test) : toujours « à l'écran »
    } else if (!saved.slideId) {
      current = true
    } else {
      office.getSelectedDataAsync(Office.CoercionType.SlideRange, function (r) {
        current = r.status === 'succeeded' && r.value && r.value.slides && r.value.slides[0] ? r.value.slides[0].id === saved.slideId : false
      })
    }
    if (current && !wasCurrent && session) sync()
    wasCurrent = current && !!session
    setTimeout(watchSlide, 1000)
  }

  // ---------- interrogation du serveur ----------
  // En diaporama, seule la diapo à l'écran interroge le serveur vite ; les autres modules
  // (jusqu'à une vingtaine chargés en même temps) se mettent en veille.
  function active() {
    return !office || view !== 'read' || current
  }
  function pace(ms) {
    if (!office) return ms
    if (view === 'read') return current ? ms : 6000
    return ms * 3 // mode Normal : simple aperçu
  }
  var lastSession = ''
  function pollSession() {
    api('GET', S(), null, function (status, data) {
      if (status === 200 && data) {
        var txt = JSON.stringify(data)
        if (txt !== lastSession) {
          lastSession = txt
          var prev = session
          session = data
          var item = targetItem(data)
          var id = item ? item.id : null
          if (id !== answersFor) {
            answersFor = id
            answers = []
          }
          if (!prev && current) sync()
          render()
        }
      }
      setTimeout(pollSession, pace(1000))
    })
  }
  function pollAnswers() {
    if (answersFor && active()) {
      var item = answersFor
      api('GET', S() + '/answers?item=' + encodeURIComponent(item), null, function (status, data) {
        if (status === 200 && data && item === answersFor) {
          var n = data.length
          var changed = n !== answers.length || JSON.stringify(data) !== JSON.stringify(answers)
          answers = data
          if (changed) render()
        }
        setTimeout(pollAnswers, pace(1000))
      })
    } else setTimeout(pollAnswers, pace(1000))
  }
  var lastPeople = ''
  function pollPeople() {
    if (!active()) return setTimeout(pollPeople, pace(2000))
    api('GET', S() + '/participants', null, function (status, data) {
      if (status === 200 && data) {
        // seuls le nombre et les prénoms comptent pour l'affichage
        var key = data.length + '|' + (data.length ? data[data.length - 1].id : '')
        participants = data
        if (key !== lastPeople) {
          lastPeople = key
          render()
        }
      }
      setTimeout(pollPeople, pace(2000))
    })
  }
  function pollQuestions() {
    var item = session ? targetItem(session) : null
    if (item && item.type === 'qa' && active()) {
      api('GET', S() + '/questions', null, function (status, data) {
        if (status === 200 && data) {
          questions = data
          render()
        }
        setTimeout(pollQuestions, pace(1500))
      })
    } else setTimeout(pollQuestions, pace(1500))
  }

  function startWith(value) {
    saved = value
    target = parse(value && value.url)
    if (!target) return setup('', value ? 'Adresse non reconnue.' : '')
    renderBar()
    render()
    api('GET', '/api/info', null, function (status, info) {
      if (info && info.publicUrl) host = info.publicUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
      render()
    })
    api('POST', '/api/live/' + target.code, null, function (status) {
      if (status !== 200) {
        $('stage').innerHTML = '<div class="center muted" style="font-size:28px">Diapo introuvable : retéléchargez la présentation depuis votre page coach.</div>'
        return
      }
      if (started) return
      started = true
      pollSession()
      pollAnswers()
      pollPeople()
      pollQuestions()
      watchSlide()
    })
  }

  function boot() {
    fit()
    window.onresize = fit
    setInterval(fit, 2000)
    var doc = window.Office && Office.context && Office.context.document
    if (!doc) {
      // hors PowerPoint : mode test avec ?url=
      var m = /[?&]url=([^&]+)/.exec(location.search)
      return startWith(m ? { url: decodeURIComponent(m[1]) } : null)
    }
    office = doc
    if (office.getActiveViewAsync)
      office.getActiveViewAsync(function (r) {
        if (r.status === 'succeeded') view = r.value
        renderBar()
      })
    if (office.addHandlerAsync && Office.EventType.ActiveViewChanged)
      office.addHandlerAsync(Office.EventType.ActiveViewChanged, function (e) {
        view = e.activeView
        renderBar()
      })
    startWith(office.settings.get(SETTING))
  }

  var booted = false
  function once() {
    if (booted) return
    booted = true
    boot()
  }
  if (window.Office) {
    Office.initialize = function () {
      once()
    }
    if (Office.onReady)
      Office.onReady(function () {
        once()
      })
  }
  // mode test hors PowerPoint (legacy.html?url=…) : office.js ne répond pas toujours
  if (/[?&]url=/.test(location.search)) setTimeout(once, 3000)
})()
