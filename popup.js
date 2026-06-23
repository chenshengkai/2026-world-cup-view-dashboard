/* 共享：球队信息弹窗（看板页与排名页通用） */
(function () {
  'use strict';

  const WC = window.WC || { teams: {} };
  const TEAMS = WC.teams || {};

  const escapeAttr = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // 淘汰赛占位符 → 中文
  function placeholderZh(s) {
    let m;
    if ((m = s.match(/^([123])([A-L])$/))) return m[2] + '组第' + m[1];
    if ((m = s.match(/^3([A-L](?:\/[A-L])+)$/))) return m[1] + '组其一第3';
    if ((m = s.match(/^W(\d+)$/))) return '第' + m[1] + '场胜者';
    if ((m = s.match(/^L(\d+)$/))) return '第' + m[1] + '场负者';
    return s;
  }

  // 生成可悬停的球队名片段（看板与排名页共用，保证交互一致）
  function teamChip(name, side) {
    const t = TEAMS[name];
    if (t) {
      const s = side || 'home';
      return '<span class="team t-' + s + '" data-team="' + escapeAttr(name) + '">' +
        (s === 'away'
          ? '<span class="fl">' + t.flag + '</span><span class="nm">' + t.zh + '</span>'
          : '<span class="nm">' + t.zh + '</span><span class="fl">' + t.flag + '</span>') +
        '</span>';
    }
    return '<span class="tbd t-' + (side || 'home') + '">' + placeholderZh(name) + '</span>';
  }

  const POS_ORDER = [['GK', '门将 GK'], ['DF', '后卫 DF'], ['MF', '中场 MF'], ['FW', '前锋 FW']];

  function popupHtml(t) {
    const crest = t.crest_url
      ? '<img class="pp-crest" src="' + escapeAttr(t.crest_url) + '" alt="队徽" onerror="this.outerHTML=\'<span class=&quot;pp-crest-emoji&quot;>' + t.flag + '</span>\'">'
      : '<span class="pp-crest-emoji">' + t.flag + '</span>';
    const stars = t.titles > 0
      ? '<span class="stars">' + '★'.repeat(Math.min(t.titles, 5)) + '</span> ' + t.titles + ' 次（' + t.titles_years + '）'
      : '暂未夺冠';

    let players = '';
    POS_ORDER.forEach(([pos, label]) => {
      const ps = (t.players || []).filter((p) => p.pos === pos);
      if (!ps.length) return;
      players += '<div class="pp-pos-h">' + label + '</div>';
      ps.forEach((p) => {
        players += '<div class="pp-player"><span class="nm">' + p.name + '</span>' +
          '<span class="age">' + p.age + '岁</span><span class="pos">' + p.pos + '</span></div>';
      });
    });

    return (
      '<div class="pp-head">' + crest +
      '<div class="pp-title"><div class="zh">' + t.zh + '</div><div class="en">' + t.en + '</div></div>' +
      '<span class="pp-group">' + t.group + '组</span></div>' +
      '<div class="pp-info">' +
      '<div class="ln"><span class="k">主教练</span><span>' + t.coach + '</span></div>' +
      '<div class="ln"><span class="k">捧杯次数</span><span>' + stars + '</span></div>' +
      '<div class="ln"><span class="k">历史最佳</span><span>' + t.best_result_zh + '</span></div>' +
      '</div>' +
      '<div class="pp-players">' + (players || '<div class="rest">名单暂缺</div>') + '</div>' +
      (t.note ? '<div class="pp-note">注：' + t.note + '</div>' : '')
    );
  }

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

  let popup = null, hideTimer = null, pinned = false;

  function ensureEl() {
    popup = document.getElementById('popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'popup'; popup.className = 'popup'; popup.hidden = true;
      document.body.appendChild(popup);
    }
    popup.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    popup.addEventListener('mouseleave', scheduleHide);
  }

  function showPopup(name, x, y) {
    const t = TEAMS[name];
    if (!t) return;
    clearTimeout(hideTimer);
    popup.innerHTML = popupHtml(t);
    popup.hidden = false;
    positionPopup(popup, x, y);
  }

  function scheduleHide() {
    if (pinned) return;
    hideTimer = setTimeout(() => { popup.hidden = true; }, 220);
  }

  function init() {
    ensureEl();
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('.team');
      if (el && !pinned) showPopup(el.dataset.team, e.clientX, e.clientY);
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest('.team')) scheduleHide();
    });
    // 点击固定/解除（兼容触屏）
    document.addEventListener('click', (e) => {
      const el = e.target.closest('.team');
      if (el) {
        pinned = true;
        showPopup(el.dataset.team, e.clientX, e.clientY);
        e.stopPropagation();
      } else if (!e.target.closest('#popup')) {
        pinned = false;
        if (popup) popup.hidden = true;
      }
    });
  }

  window.WCPopup = { init, escapeAttr, placeholderZh, positionPopup, popupHtml, teamChip };
})();
