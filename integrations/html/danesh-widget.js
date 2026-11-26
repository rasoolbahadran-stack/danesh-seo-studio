/**
 * Danesh SEO Studio — embeddable HTML widget.
 * Usage on any static site:
 *   <script src="https://YOUR-API/widget/danesh-widget.js"
 *     data-api="https://YOUR-API"
 *     data-article-id="ARTICLE_ID"
 *     data-workspace-id="WORKSPACE_ID"
 *     data-token="SHARE_TOKEN"></script>
 * Renders a live SEO score badge fetched from the public report endpoint.
 * No secrets are embedded — the share token is workspace-scoped and revocable.
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script) return;

  var api = (script.getAttribute('data-api') || '').replace(/\/$/, '');
  var articleId = script.getAttribute('data-article-id');
  var workspaceId = script.getAttribute('data-workspace-id');
  var token = script.getAttribute('data-token');

  if (!api || !articleId || !workspaceId || !token) {
    console.warn('[DaneshWidget] data-api, data-article-id, data-workspace-id, data-token are required');
    return;
  }

  var host = document.createElement('div');
  host.setAttribute('dir', 'rtl');
  host.style.cssText = 'display:inline-block;font-family:Vazirmatn,Tahoma,sans-serif;font-size:13px;line-height:1.6;';
  script.parentNode.insertBefore(host, script);

  function render(state) {
    var color = state.score >= 75 ? '#16a34a' : state.score >= 50 ? '#ea580c' : '#dc2626';
    var label = state.score >= 75 ? 'سئو: مناسب' : state.score >= 50 ? 'سئو: نیازمند بهبود' : 'سئو: ایراد دارد';
    host.innerHTML =
      '<a href="' + api + '" target="_blank" rel="noopener" style="text-decoration:none">' +
      '<span style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border:1px solid ' + color + ';border-radius:999px;background:#fff;color:' + color + ';font-weight:700">' +
      '<span style="width:10px;height:10px;border-radius:50%;background:' + color + '"></span>' +
      label + ' — ' + state.score + '/100' +
      '</span></a>';
  }

  fetch(api + '/api/v1/public/workspaces/' + encodeURIComponent(workspaceId) + '/articles/' + encodeURIComponent(articleId) + '/report?token=' + encodeURIComponent(token))
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      if (typeof data.score !== 'number') throw new Error('no score');
      render(data);
    })
    .catch(function (err) {
      host.innerHTML = '<span style="color:#64748b">[دانش سئو: گزارش در دسترس نیست]</span>';
      console.warn('[DaneshWidget]', err.message);
    });
})();
