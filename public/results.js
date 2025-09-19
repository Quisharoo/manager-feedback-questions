(function(){
    function getParams() {
        try {
            const u = new URL(window.location.href);
            return {
                id: u.searchParams.get('id') || '',
                key: u.searchParams.get('key') || '',
                cap: u.searchParams.get('cap') || ''
            };
        } catch { return { id: '', key: '', cap: '' }; }
    }

    function download(filename, text) {
        const a = document.createElement('a');
        a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        a.setAttribute('download', filename);
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function toCsv(rows) {
        function esc(v){
            const s = String(v == null ? '' : v);
            if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
            return s;
        }
        return rows.map(r => r.map(esc).join(',')).join('\n');
    }

    async function fetchSession(id, key, cap) {
        const endpoint = cap === '1' ? `/api/capsessions/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`
                                     : `/api/sessions/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('Failed');
        return res.json();
    }

    function renderAnswers(container, data) {
        container.innerHTML = '';
        const asked = Array.isArray(data.asked) ? data.asked : [];
        const answers = (data && typeof data.answers === 'object') ? data.answers : {};
        if (asked.length === 0 && Object.keys(answers).length === 0) {
            container.innerHTML = '<div class="text-gray-500">No results yet.</div>';
            return;
        }
        const frag = document.createDocumentFragment();
        for (const q of asked) {
            const card = document.createElement('div');
            card.className = 'border border-gray-200 rounded p-3 mb-3';
            const theme = document.createElement('div');
            theme.className = 'text-xs text-gray-500 mb-1';
            theme.textContent = q.theme || '';
            const text = document.createElement('div');
            text.className = 'text-sm font-medium mb-2';
            text.textContent = q.text || '';
            const ans = document.createElement('div');
            ans.className = 'text-sm whitespace-pre-wrap';
            ans.textContent = answers[q.text] || '';
            card.appendChild(theme);
            card.appendChild(text);
            card.appendChild(ans);
            frag.appendChild(card);
        }
        container.appendChild(frag);
    }

    async function init() {
        const { id, key, cap } = getParams();
        const info = document.getElementById('info');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const results = document.getElementById('results');
        const answersEl = document.getElementById('answers');
        const exportJson = document.getElementById('exportJson');
        const exportCsvBtn = document.getElementById('exportCsv');
        if (!id || !key) {
            loading.classList.add('hidden');
            error.classList.remove('hidden');
            return;
        }
        info.textContent = `Session ID: ${id}`;
        try {
            const data = await fetchSession(id, key, cap);
            loading.classList.add('hidden');
            results.classList.remove('hidden');
            renderAnswers(answersEl, data);
            exportJson.addEventListener('click', () => {
                download(`session-${id}.json`, JSON.stringify(data, null, 2));
            });
            exportCsvBtn.addEventListener('click', () => {
                const asked = Array.isArray(data.asked) ? data.asked : [];
                const answers = (data && typeof data.answers === 'object') ? data.answers : {};
                const rows = [["Theme","Question","Answer"]];
                for (const q of asked) rows.push([q.theme || '', q.text || '', answers[q.text] || '']);
                download(`session-${id}.csv`, toCsv(rows));
            });
        } catch (e) {
            loading.classList.add('hidden');
            error.classList.remove('hidden');
        }
    }

    if (typeof window !== 'undefined') {
        init();
    }
})();


