/* 2026 世界杯 · 分组积分榜 */
(function () {
  'use strict';

  const WC = window.WC || { teams: {}, matches: [], groups: [], generated: '' };
  const TEAMS = WC.teams || {};
  const chip = (window.WCPopup && WCPopup.teamChip) || ((n) => n);

  // 小组赛阶段 → 组字母
  function groupLetter(stage) {
    const m = /^Group ([A-L])$/i.exec(stage || '');
    return m ? m[1].toUpperCase() : null;
  }

  // ---------- 计算每组积分 ----------
  // 仅计入已完赛(finished)比赛；进行中(live)单独提示、不计入官方积分
  function buildGroups() {
    const groups = {};
    (WC.groups || []).forEach((g) => {
      const rows = {};
      g.teams.forEach((t, i) => {
        rows[t.en] = {
          en: t.en, zh: t.zh, flag: t.flag, _seed: i,
          P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0,
        };
      });
      groups[g.group] = { letter: g.group, rows, live: 0 };
    });

    (WC.matches || []).forEach((m) => {
      const L = groupLetter(m.stage);
      if (!L || !groups[L]) return;
      const G = groups[L];
      if (m.status === 'live') { G.live++; return; }
      if (m.status !== 'finished') return;
      const h = G.rows[m.home], a = G.rows[m.away];
      if (!h || !a) return;
      const hs = m.home_score, as = m.away_score;
      if (typeof hs !== 'number' || typeof as !== 'number') return;
      h.P++; a.P++;
      h.GF += hs; h.GA += as;
      a.GF += as; a.GA += hs;
      if (hs > as) { h.W++; h.Pts += 3; a.L++; }
      else if (hs < as) { a.W++; a.Pts += 3; h.L++; }
      else { h.D++; a.D++; h.Pts++; a.Pts++; }
    });

    return groups;
  }

  const gd = (r) => r.GF - r.GA;

  // 头对头小表：仅统计 tied 球队之间的已完赛比赛
  function headToHead(tied) {
    const set = new Set(tied.map((r) => r.en));
    const mini = {};
    tied.forEach((r) => { mini[r.en] = { Pts: 0, GF: 0, GA: 0 }; });
    (WC.matches || []).forEach((m) => {
      if (m.status !== 'finished') return;
      if (!groupLetter(m.stage)) return;
      if (!set.has(m.home) || !set.has(m.away)) return;
      const hs = m.home_score, as = m.away_score;
      if (typeof hs !== 'number' || typeof as !== 'number') return;
      mini[m.home].GF += hs; mini[m.home].GA += as;
      mini[m.away].GF += as; mini[m.away].GA += hs;
      if (hs > as) mini[m.home].Pts += 3;
      else if (hs < as) mini[m.away].Pts += 3;
      else { mini[m.home].Pts++; mini[m.away].Pts++; }
    });
    return mini;
  }

  // FIFA 排名规则：1)积分 2)总净胜球 3)总进球；并列再看
  // 4)相互间积分 5)相互间净胜球 6)相互间进球；仍并列按抽签(此处保持种子序，UI注明)
  function rankRows(rowsObj) {
    const rows = Object.values(rowsObj);
    const eqOverall = (a, b) => a.Pts === b.Pts && gd(a) === gd(b) && a.GF === b.GF;
    rows.sort((a, b) => (b.Pts - a.Pts) || (gd(b) - gd(a)) || (b.GF - a.GF) || (a._seed - b._seed));

    let i = 0;
    while (i < rows.length) {
      let j = i + 1;
      while (j < rows.length && eqOverall(rows[i], rows[j])) j++;
      if (j - i > 1) {
        const tied = rows.slice(i, j);
        const h2h = headToHead(tied);
        tied.sort((a, b) =>
          (h2h[b.en].Pts - h2h[a.en].Pts) ||
          ((h2h[b.en].GF - h2h[b.en].GA) - (h2h[a.en].GF - h2h[a.en].GA)) ||
          (h2h[b.en].GF - h2h[a.en].GF) ||
          (a._seed - b._seed));
        for (let k = i; k < j; k++) rows[k] = tied[k - i];
      }
      i = j;
    }
    return rows;
  }

  // ---------- 渲染单个小组 ----------
  function numCell(v, cls) { return '<td class="' + (cls || '') + '">' + v + '</td>'; }

  function groupCard(G) {
    const ranked = rankRows(G.rows);
    const played = ranked.reduce((s, r) => s + r.P, 0) / 2;
    const liveTag = G.live ? '<span class="g-live">● ' + G.live + ' 场进行中</span>' : '';

    let body = '';
    ranked.forEach((r, idx) => {
      const rank = idx + 1;
      const zoneCls = rank <= 2 ? 'q1' : (rank === 3 ? 'q3' : '');
      const diff = gd(r);
      body +=
        '<tr class="' + zoneCls + '">' +
        '<td class="r-rank"><span class="rank-badge">' + rank + '</span></td>' +
        '<td class="r-team">' + chip(r.en, 'away') + '</td>' +
        numCell(r.P) + numCell(r.W) + numCell(r.D) + numCell(r.L) +
        numCell(r.GF) + numCell(r.GA) +
        numCell((diff > 0 ? '+' : '') + diff, 'r-gd') +
        numCell(r.Pts, 'r-pts') +
        '</tr>';
    });

    return (
      '<div class="grp">' +
      '<div class="grp-head"><span class="grp-name">' + G.letter + ' 组</span>' +
      '<span class="grp-prog">已赛 ' + played + '/6</span>' + liveTag + '</div>' +
      '<table class="grp-table"><thead><tr>' +
      '<th></th><th class="h-team">球队</th>' +
      '<th title="场次">赛</th><th title="胜">胜</th><th title="平">平</th><th title="负">负</th>' +
      '<th title="进球">进</th><th title="失球">失</th><th title="净胜球">净</th><th title="积分">分</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>'
    );
  }

  // ---------- 最佳第三名（48队赛制：8个小组第3晋级）----------
  function bestThirds(groups) {
    const thirds = Object.values(groups).map((G) => {
      const ranked = rankRows(G.rows);
      const r = ranked[2];
      return r ? { letter: G.letter, r } : null;
    }).filter(Boolean);

    thirds.sort((x, y) =>
      (y.r.Pts - x.r.Pts) || (gd(y.r) - gd(x.r)) || (y.r.GF - x.r.GF) ||
      x.letter.localeCompare(y.letter));

    let body = '';
    thirds.forEach((t, idx) => {
      const rank = idx + 1;
      const diff = gd(t.r);
      body +=
        '<tr class="' + (rank <= 8 ? 'q1' : 'qout') + '">' +
        '<td class="r-rank"><span class="rank-badge">' + rank + '</span></td>' +
        '<td class="r-grp">' + t.letter + '组</td>' +
        '<td class="r-team">' + chip(t.r.en, 'away') + '</td>' +
        numCell(t.r.P) + numCell(t.r.Pts, 'r-pts') +
        numCell((diff > 0 ? '+' : '') + diff, 'r-gd') + numCell(t.r.GF) +
        '</tr>';
    });

    return (
      '<div class="grp grp-thirds">' +
      '<div class="grp-head"><span class="grp-name">最佳第三名排名</span>' +
      '<span class="grp-prog">前 8 名晋级</span></div>' +
      '<table class="grp-table"><thead><tr>' +
      '<th></th><th>小组</th><th class="h-team">球队</th>' +
      '<th title="场次">赛</th><th title="积分">分</th><th title="净胜球">净</th><th title="进球">进</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table>' +
      '<div class="thirds-note">各组第3名按 积分 → 净胜球 → 进球 排序，前 8 名进入 1/16 决赛。</div>' +
      '</div>'
    );
  }

  // ---------- 装配 ----------
  function render() {
    const groups = buildGroups();
    const order = Object.keys(groups).sort();
    const cards = order.map((k) => groupCard(groups[k])).join('');

    document.getElementById('standings').innerHTML = cards;
    document.getElementById('thirds').innerHTML = bestThirds(groups);

    if (window.WCPopup) WCPopup.init();

    const totalFin = (WC.matches || []).filter((m) => groupLetter(m.stage) && m.status === 'finished').length;
    document.getElementById('foot').textContent =
      '小组赛已完赛 ' + totalFin + '/72 场 · 数据快照: ' + (WC.generated || '—') +
      ' · 并列排名依据 FIFA 规则：积分 → 净胜球 → 进球 → 相互战绩（公平竞赛分/抽签未建模）';
  }

  render();
})();
