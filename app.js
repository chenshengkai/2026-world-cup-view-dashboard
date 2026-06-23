/* 2026 世界杯观赛看板 */
(function () {
  'use strict';

  const WC = window.WC || { teams: {}, matches: [], groups: [], generated: '' };
  const TEAMS = WC.teams;
  const MATCHES = WC.matches.slice();

  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  MATCHES.forEach((m) => { m.dt = new Date(m.kickoff_iso); });
  MATCHES.sort((a, b) => a.dt - b.dt || a.match_no - b.match_no);
  const BY_NO = new Map(MATCHES.map((m) => [String(m.match_no), m]));

  // ---------- 阶段映射 ----------
  function stageInfo(stage) {
    if (/^Group ([A-L])$/i.test(stage)) {
      const g = stage.match(/^Group ([A-L])$/i)[1].toUpperCase();
      return { zh: g + '组', cls: 'st-group' };
    }
    if (/32/.test(stage)) return { zh: '1/16决赛', cls: 'st-r32' };
    if (/16/.test(stage)) return { zh: '1/8决赛', cls: 'st-r16' };
    if (/quarter/i.test(stage)) return { zh: '1/4决赛', cls: 'st-qf' };
    if (/semi/i.test(stage)) return { zh: '半决赛', cls: 'st-sf' };
    if (/third/i.test(stage)) return { zh: '季军赛', cls: 'st-3rd' };
    if (/final/i.test(stage)) return { zh: '决赛', cls: 'st-final' };
    return { zh: stage, cls: 'st-group' };
  }

  // 淘汰赛占位符 → 中文
  function placeholderZh(s) {
    let m;
    if ((m = s.match(/^([123])([A-L])$/))) return m[2] + '组第' + m[1];
    if ((m = s.match(/^3([A-L](?:\/[A-L])+)$/))) return m[1] + '组其一第3';
    if ((m = s.match(/^W(\d+)$/))) return '第' + m[1] + '场胜者';
    if ((m = s.match(/^L(\d+)$/))) return '第' + m[1] + '场负者';
    return s;
  }

  function teamHtml(name, side) {
    const t = TEAMS[name];
    if (t) {
      return '<span class="team t-' + side + '" data-team="' + escapeAttr(name) + '">' +
        (side === 'home'
          ? '<span class="nm">' + t.zh + '</span><span class="fl">' + t.flag + '</span>'
          : '<span class="fl">' + t.flag + '</span><span class="nm">' + t.zh + '</span>') +
        '</span>';
    }
    return '<span class="tbd t-' + side + '">' + placeholderZh(name) + '</span>';
  }

  const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // ---------- 日历 ----------
  function buildCalendar() {
    const byDate = new Map();
    MATCHES.forEach((m) => {
      const k = dkey(m.dt);
      if (!byDate.has(k)) byDate.set(k, []);
      byDate.get(k).push(m);
    });

    const dates = [...byDate.keys()].sort();
    if (!dates.length) {
      document.getElementById('calendar').innerHTML = '<p class="rest">暂无赛程数据</p>';
      return;
    }
    const first = new Date(dates[0] + 'T00:00:00');
    const last = new Date(dates[dates.length - 1] + 'T00:00:00');
    // 周一为每周第一天
    const start = new Date(first); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(last); end.setDate(end.getDate() + (6 - (end.getDay() + 6) % 7));

    const todayKey = dkey(new Date());
    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].forEach((w) => {
      const h = document.createElement('div'); h.className = 'dow'; h.textContent = w; grid.appendChild(h);
    });

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = dkey(d);
      const inRange = k >= dates[0] && k <= dates[dates.length - 1];
      const ms = byDate.get(k) || [];
      const isToday = k === todayKey;
      const show = inRange || isToday || ms.length > 0;
      const cell = document.createElement('div');
      cell.className = 'day' + (!show ? ' empty' : (ms.length ? '' : ' norest')) + (isToday ? ' today' : '');

      if (show) {
        const head = document.createElement('div');
        head.className = 'day-head';
        head.innerHTML = '<span class="day-num">' + d.getDate() + '</span>' +
          '<span class="day-mon">' + (d.getMonth() + 1) + '月</span>' +
          (isToday ? '<span class="today-tag">今天</span>' : '');
        cell.appendChild(head);
        if (!ms.length) {
          const r = document.createElement('div'); r.className = 'rest';
          r.textContent = isToday ? '今天暂无比赛' : '— 休赛日 —';
          cell.appendChild(r);
        }
      }

      ms.forEach((m) => cell.appendChild(matchEl(m)));
      grid.appendChild(cell);
    }

    const cal = document.getElementById('calendar');
    cal.innerHTML = '';
    cal.appendChild(grid);
  }

  function matchEl(m) {
    const si = stageInfo(m.stage);
    const el = document.createElement('div');
    el.className = 'match ' + si.cls;
    el.dataset.home = m.home; el.dataset.away = m.away;
    el.dataset.no = m.match_no;

    const localTime = pad(m.dt.getHours()) + ':' + pad(m.dt.getMinutes());
    const finished = m.status === 'finished';
    const live = m.status === 'live';
    const mid = finished || live
      ? '<span class="score">' + m.home_score + ':' + m.away_score + '</span>'
      : '<span class="mid">vs</span>';

    el.innerHTML =
      '<div class="meta"><span class="stage-tag">' + si.zh + '</span>' +
      (live ? '<span class="live-tag">● 直播中</span>' : '') +
      '<span class="ktime">' + (finished ? '完赛' : localTime) + '</span></div>' +
      '<div class="row">' + teamHtml(m.home, 'home') + mid + teamHtml(m.away, 'away') + '</div>' +
      (m.penalties ? '<div class="pens">点球大战 ' + m.penalties + '</div>' : '');

    const venueLocal = m.kickoff_iso.replace('T', ' ').slice(0, 16);
    el.title = '第' + m.match_no + '场 · ' + si.zh + '\n球场: ' + m.venue + '（' + (m.city_zh || m.city) + '）\n当地开球: ' + venueLocal;
    return el;
  }

  // ---------- 球队弹窗（逻辑见 popup.js，看板与排名页共用） ----------
  if (window.WCPopup) WCPopup.init();

  function positionPopup(el, x, y) {
    const W = el.offsetWidth, H = el.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + W > innerWidth - 8) left = x - W - 14;
    if (left < 8) left = 8;
    if (top + H > innerHeight - 8) top = innerHeight - H - 8;
    if (top < 8) top = 8;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  // ---------- 比分赛况弹窗 ----------
  const scorePop = document.createElement('div');
  scorePop.className = 'popup score-pop';
  scorePop.hidden = true;
  document.body.appendChild(scorePop);
  let spHideTimer = null;

  const EV_ICON = { goal: '⚽', pen: '⚽', og: '⚽', yellow: '🟨', red: '🟥' };

  function evMinuteVal(min) {
    const m = String(min).match(/^(\d+)(?:\+(\d+))?/);
    return m ? parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 100 : 0) : 999;
  }

  function evHtml(e, side) {
    let label = e.player || '';
    if (e.type === 'pen') label += '（点球）';
    if (e.type === 'og') label += '（乌龙）';
    const min = '<span class="ev-min">' + e.minute + '′</span>';
    const ic = '<span class="ev-ic">' + (EV_ICON[e.type] || '·') + '</span>';
    const nm = '<span class="ev-nm">' + label + '</span>';
    // 主队列贴右侧中线、客队列贴左侧中线，分钟靠中线一侧
    const line = side === 'home' ? nm + ' ' + ic + ' ' + min : min + ' ' + ic + ' ' + nm;
    return '<div class="ev">' + line +
      (e.assist ? '<div class="ev-as">助攻 ' + e.assist + '</div>' : '') + '</div>';
  }

  function scorePopHtml(m) {
    const si = stageInfo(m.stage);
    const h = TEAMS[m.home] || { zh: placeholderZh(m.home), flag: '' };
    const a = TEAMS[m.away] || { zh: placeholderZh(m.away), flag: '' };
    const status = m.status === 'live' ? '<span class="live-tag">● 直播中</span>' : '完赛';
    const ev = m.events || {};
    const col = (list, side) => (list || []).slice()
      .sort((x, y) => evMinuteVal(x.minute) - evMinuteVal(y.minute))
      .map((e) => evHtml(e, side)).join('');
    const homeHtml = col(ev.home, 'home'), awayHtml = col(ev.away, 'away');
    const body = (homeHtml || awayHtml)
      ? '<div class="sp-body"><div class="sp-col sp-home">' + homeHtml + '</div>' +
        '<div class="sp-col sp-away">' + awayHtml + '</div></div>'
      : '<div class="sp-empty">暂无事件数据</div>';
    return '<div class="sp-head"><span class="sp-team">' + h.zh + ' ' + h.flag + '</span>' +
      '<span class="sp-score">' + m.home_score + ':' + m.away_score + '</span>' +
      '<span class="sp-team">' + a.flag + ' ' + a.zh + '</span></div>' +
      '<div class="sp-sub">' + si.zh + ' · ' + status +
      (m.penalties ? ' · 点球大战 ' + m.penalties : '') + '</div>' + body;
  }

  function spHide() {
    spHideTimer = setTimeout(() => { scorePop.hidden = true; }, 220);
  }

  document.addEventListener('mouseover', (e) => {
    const sc = e.target.closest('.score');
    if (!sc) return;
    const card = sc.closest('.match');
    const m = card && BY_NO.get(card.dataset.no);
    if (!m) return;
    clearTimeout(spHideTimer);
    scorePop.innerHTML = scorePopHtml(m);
    scorePop.hidden = false;
    positionPopup(scorePop, e.clientX, e.clientY);
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('.score')) spHide();
  });
  scorePop.addEventListener('mouseenter', () => clearTimeout(spHideTimer));
  scorePop.addEventListener('mouseleave', spHide);

  // ---------- 筛选 ----------
  function buildFilter() {
    const sel = document.getElementById('teamFilter');
    (WC.groups || []).forEach((g) => {
      const og = document.createElement('optgroup');
      og.label = g.group + ' 组';
      g.teams.forEach((t) => {
        const o = document.createElement('option');
        o.value = t.en; o.textContent = t.flag + ' ' + t.zh;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    sel.addEventListener('change', () => {
      const v = sel.value;
      document.querySelectorAll('.match').forEach((m) => {
        m.classList.toggle('dimmed', !!v && m.dataset.home !== v && m.dataset.away !== v);
      });
    });
  }

  // ---------- 图例 / 页脚 ----------
  function buildLegend() {
    const items = [
      ['#5573ab', '小组赛'], ['#2eb8af', '1/16决赛'], ['#4596e0', '1/8决赛'],
      ['#a06ae0', '1/4决赛'], ['#e89a3c', '半决赛'], ['#f5c542', '决赛'],
    ];
    document.getElementById('legend').innerHTML = items
      .map(([c, n]) => '<span class="lg"><span class="dot" style="background:' + c + '"></span>' + n + '</span>')
      .join('');

    let tzName = '您的本地时区';
    try { tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || tzName; } catch (e) { /* 忽略 */ }
    document.getElementById('tzNote').textContent = '⏰ 开球时间已换算为 ' + tzName + ' 时间，日期按该时区归档';

    const fin = MATCHES.filter((m) => m.status === 'finished').length;
    document.getElementById('foot').textContent =
      '共 ' + MATCHES.length + ' 场比赛，已完赛 ' + fin + ' 场 · 数据快照: ' + (WC.generated || '—') +
      ' · 数据来源: Wikipedia / FIFA（赛果与名单以官方为准）';
  }

  buildCalendar();
  buildFilter();
  buildLegend();
})();
