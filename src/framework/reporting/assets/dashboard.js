(function () {
  'use strict';
  function start() {
    var state = document.getElementById('dashboardJsStatus');
    try {
      var rows = Array.prototype.slice.call(document.querySelectorAll('.test-row'));
      var body = document.querySelector('#testsTable tbody');
      var controls = [
        document.getElementById('searchFilter'), document.getElementById('statusFilter'), document.getElementById('layerFilter'),
        document.getElementById('typeFilter'), document.getElementById('projectFilter'), document.getElementById('tagFilter'),
        document.getElementById('categoryFilter'), document.getElementById('specialFilter'), document.getElementById('sortFilter')
      ];
      function current(i) { return controls[i] ? String(controls[i].value || '').toLowerCase() : ''; }
      function exactPipe(value, needle) { if (!needle) return true; return String(value || '').split('|').indexOf(needle) >= 0; }
      function visibleRows() { return rows.filter(function (row) { return !row.hidden; }); }
      function groupOutcome(row) {
        var outcome = String(row.dataset.outcome || '').toLowerCase();
        if (outcome === 'known_defect') return 'Known Defect';
        if (outcome === 'failed') return 'Failed';
        if (outcome === 'unexpected_pass') return 'Unexpected Pass';
        if (outcome === 'skipped') return row.dataset.skipDisposition === 'not_applicable' ? 'Not Applicable' : 'Blocked';
        return 'Passed';
      }
      function renderDonut(visible) {
        var labels = ['Passed', 'Known Defect', 'Failed', 'Unexpected Pass', 'Not Applicable', 'Blocked'];
        var palette = { Passed:'#059669','Known Defect':'#d97706',Failed:'#dc2626','Unexpected Pass':'#7c3aed','Not Applicable':'#94a3b8',Blocked:'#dc2626' };
        var items = labels.map(function (label) { return { label: label, value: visible.filter(function (row) { return groupOutcome(row) === label; }).length }; });
        var qualityPassed = items[0].value + items[3].value;
        var qualityFailed = items[1].value + items[2].value;
        var qualityExecuted = qualityPassed + qualityFailed;
        var rate = qualityExecuted ? Math.round(qualityPassed / qualityExecuted * 1000) / 10 : 0;
        var donut = document.getElementById('statusDonut'), legend = document.getElementById('statusLegend');
        if (donut) {
          var total = items.reduce(function (sum, item) { return sum + item.value; }, 0), radius = 50, circumference = 2 * Math.PI * radius, cursor = 0;
          var segments = total ? items.filter(function(item){ return item.value > 0; }).map(function (item) {
            var length = item.value / total * circumference, offset = -cursor; cursor += length;
            return '<circle class="donut-segment" data-status="'+item.label.toLowerCase()+'" cx="60" cy="60" r="50" stroke="'+palette[item.label]+'" stroke-dasharray="'+length.toFixed(3)+' '+(circumference-length).toFixed(3)+'" stroke-dashoffset="'+offset.toFixed(3)+'"/>';
          }).join('') : '';
          donut.innerHTML = '<svg class="status-donut-svg" viewBox="0 0 120 120" role="img"><circle class="donut-track" cx="60" cy="60" r="50"/>'+segments+'<text id="donutPassRate" class="donut-rate" x="60" y="57">'+rate+'%</text><text class="donut-label" x="60" y="72">quality pass</text></svg>';
        }
        if (legend) legend.innerHTML = items.filter(function(item){ return item.value > 0 || item.label === 'Passed'; }).map(function (item) { return '<div class="legend-row"><svg class="legend-dot" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="'+palette[item.label]+'"/></svg><span>'+item.label+'</span><b>'+item.value+'</b></div>'; }).join('');
        setText('filteredPass', 'Pass ' + items[0].value);
        setText('filteredKnown', 'Known ' + items[1].value);
        setText('filteredFail', 'Fail ' + items[2].value);
        setText('filteredSkip', 'Not applicable ' + items[4].value + ' · Blocked ' + items[5].value);
      }
      function renderBars(id, items) {
        var el = document.getElementById(id); if (!el) return;
        if (!items.length || items.every(function (i) { return i.value === 0; })) { el.innerHTML = '<div class="empty">No data for current filters.</div>'; return; }
        var max = Math.max.apply(Math, [1].concat(items.map(function (i) { return i.value; })));
        el.innerHTML = items.map(function (item) { return '<div class="bar-row"><span>'+escapeHtml(item.label)+'</span><span class="bar-track"><span class="bar-fill" style="width:'+(item.value/max*100)+'%"></span></span><b>'+item.value+'</b></div>'; }).join('');
      }
      function refreshCharts(visible) {
        renderDonut(visible);
        var layer = { UI:0, API:0, Database:0, Other:0 }, failure = {};
        visible.forEach(function (row) {
          if (row.dataset.outcome !== 'skipped') {
            var layers = String(row.dataset.layers || '').split('|').filter(Boolean); if (!layers.length) layer.Other++;
            layers.forEach(function (x) { if (x === 'ui') layer.UI++; else if (x === 'api') layer.API++; else if (x === 'database') layer.Database++; });
          }
          if ((row.dataset.outcome === 'failed' || row.dataset.outcome === 'known_defect') && row.dataset.category) {
            var c = String(row.dataset.category).toUpperCase(); failure[c] = (failure[c] || 0) + 1;
          }
        });
        renderBars('layerBars', Object.keys(layer).map(function (k) { return { label:k, value:layer[k] }; }));
        renderBars('failureBars', Object.keys(failure).map(function (k) { return { label:k, value:failure[k] }; }));
      }
      function sortRows() {
        if (!body) return;
        var mode = current(8), rank = { failed:0, unexpected_pass:1, known_defect:2, passed_after_retry:3, passed_with_healing:4, skipped:5, passed:6 }, ordered = rows.slice();
        ordered.sort(function (a, b) {
          if (mode === 'status') return (rank[a.dataset.outcome] == null ? 9 : rank[a.dataset.outcome]) - (rank[b.dataset.outcome] == null ? 9 : rank[b.dataset.outcome]);
          if (mode === 'duration-desc') return Number(b.dataset.duration || 0) - Number(a.dataset.duration || 0);
          if (mode === 'retries-desc') return Number(b.dataset.retries || 0) - Number(a.dataset.retries || 0);
          if (mode === 'name') return String(a.dataset.title || '').localeCompare(String(b.dataset.title || ''));
          return rows.indexOf(a) - rows.indexOf(b);
        });
        ordered.forEach(function (row) { body.appendChild(row); });
      }
      function applyFilters() {
        var search=current(0),outcome=current(1),layer=current(2),type=current(3),project=current(4),tag=current(5),category=current(6),special=current(7),shown=0;
        rows.forEach(function (row) {
          var searchable=(String(row.dataset.title||'')+' '+String(row.dataset.file||'')+' '+String(row.dataset.tags||'')+' '+String(row.dataset.defect||'')).toLowerCase();
          var specialOk=!special || (special==='flaky'&&row.dataset.flaky==='true') || (special==='healed'&&row.dataset.healed==='true') || (special==='known-defect'&&row.dataset.knownDefect==='true') || (special==='ci-blocking'&&row.dataset.ciBlocking==='true');
          var ok=(!search||searchable.indexOf(search)>=0)&&(!outcome||row.dataset.outcome===outcome)&&exactPipe(row.dataset.layers,layer)&&(!type||row.dataset.type===type)&&(!project||row.dataset.project===project)&&exactPipe(row.dataset.tags,tag)&&(!category||row.dataset.category===category)&&specialOk;
          row.hidden=!ok; if(ok)shown++;
        });
        sortRows(); var visible=visibleRows(); setText('showing','Showing '+shown+' of '+rows.length+' business scenarios · charts reflect current filters'); refreshCharts(visible); updateHash();
      }
      function reset() { controls.forEach(function (c) { if(c)c.value=''; }); if(controls[8])controls[8].value='default'; applyFilters(); }
      controls.forEach(function (control) { if(control){control.addEventListener('input',applyFilters);control.addEventListener('change',applyFilters);} });
      var resetBtn=document.getElementById('resetBtn'); if(resetBtn)resetBtn.addEventListener('click',reset);
      var expandBtn=document.getElementById('expandBtn'); if(expandBtn)expandBtn.addEventListener('click',function(){visibleRows().forEach(function(row){var d=row.querySelector('.scenario-details');if(d)d.open=true;});});
      var collapseBtn=document.getElementById('collapseBtn'); if(collapseBtn)collapseBtn.addEventListener('click',function(){document.querySelectorAll('.scenario-details').forEach(function(d){d.open=false;});});
      var printBtn=document.getElementById('printBtn'); if(printBtn)printBtn.addEventListener('click',function(){window.print();});
      var exportBtn=document.getElementById('exportBtn'); if(exportBtn)exportBtn.addEventListener('click',function(){exportCsv(visibleRows());});
      restoreHash(); applyFilters();
      if(state){state.textContent='Interactive controls ready';state.classList.add('ready');}
    } catch (error) {
      console.error('Dashboard initialization failed',error); if(state){state.textContent='Interactive controls unavailable: '+String(error && error.message || error);state.classList.add('error');}
    }
  }
  function setText(id,value){var el=document.getElementById(id);if(el)el.textContent=value;}
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function csvCell(value){return '"'+String(value).replace(/"/g,'""')+'"';}
  function exportCsv(rows){
    var values=[['Scenario','Business Outcome','Raw Status','Quality','CI Blocking','Known Defect','Test Type','Project','Tags','Duration','Retries','Failure Category']];
    rows.forEach(function(row){values.push([row.querySelector('.scenario-title')&&row.querySelector('.scenario-title').textContent||'',String(row.dataset.outcome||'').replace(/_/g,' ').toUpperCase(),row.dataset.status||'',(row.dataset.outcome==='failed'||row.dataset.outcome==='known_defect')?'FAIL':row.dataset.outcome==='skipped'?'NEUTRAL':'PASS',row.dataset.ciBlocking||'false',row.dataset.knownDefect||'false',row.dataset.type||'',row.dataset.project||'',row.dataset.tags||'',row.cells[5]&&row.cells[5].textContent||'',row.cells[6]&&row.cells[6].textContent||'',row.dataset.category||'']);});
    var blob=new Blob([values.map(function(r){return r.map(csvCell).join(',');}).join('\n')+'\n'],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='filtered-business-tests.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  function updateHash(){try{var ids=['searchFilter','statusFilter','layerFilter','typeFilter','projectFilter','tagFilter','categoryFilter','specialFilter','sortFilter'],p=new URLSearchParams();ids.forEach(function(id){var el=document.getElementById(id);if(el&&el.value)p.set(id,el.value);});history.replaceState(null,'',p.toString()?'#'+p.toString():location.pathname+location.search);}catch(_) {}}
  function restoreHash(){try{if(!location.hash)return;var p=new URLSearchParams(location.hash.slice(1));p.forEach(function(value,key){var el=document.getElementById(key);if(el)el.value=value;});}catch(_) {}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
