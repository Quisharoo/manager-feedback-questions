(function() {
        function ensureInstance(container) {
                if (!container._askedListInstance) {
                        container._askedListInstance = {
                                askedIds: [],
                                questionsById: new Map(),
                                timestamps: [],
                                onSelect: function() {},
                                sort: 'desc', // 'desc' most recent first
                                selectedId: null,
                                page: 1,
                                pageSize: 12,
                        };
                }
                return container._askedListInstance;
        }

        const PAGE_SIZE_KEY = 'ui:askedPageSize';
        function getSavedPageSize() {
                try {
                        const raw = localStorage.getItem(PAGE_SIZE_KEY);
                        const n = Number(raw);
                        return [6, 12, 24, 48].includes(n) ? n : 12;
                } catch { return 12; }
        }
        function savePageSize(value) {
                try { localStorage.setItem(PAGE_SIZE_KEY, String(value)); } catch {}
        }

        function buildLayout(container) {
                container.innerHTML = '';
                const wrapper = document.createElement('div');
                wrapper.className = 'flex flex-col h-[560px] rounded-xl bg-white shadow-sm overflow-hidden';

                const header = document.createElement('div');
                header.className = 'sticky top-0 z-10 bg-white px-3 pt-3 pb-2 border-b flex flex-wrap items-center gap-2';
                const title = document.createElement('h2');
                title.className = 'text-sm font-semibold mr-auto';
                title.textContent = 'Asked in this session';

                const search = document.createElement('input');
                search.type = 'text';
                search.placeholder = 'Search asked…';
                search.setAttribute('aria-label', 'Search asked questions');
                search.className = 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';

                const sortBtn = document.createElement('button');
                sortBtn.type = 'button';
                sortBtn.className = 'px-2 py-1 text-xs border border-gray-300 rounded text-gray-700';
                sortBtn.setAttribute('aria-label', 'Toggle sort order');
                sortBtn.textContent = 'Most recent';

                const pageSizeLabel = document.createElement('label');
                pageSizeLabel.className = 'text-xs text-gray-600';
                pageSizeLabel.textContent = 'Items per page:';
                pageSizeLabel.htmlFor = 'askedPageSize';
                const pageSize = document.createElement('select');
                pageSize.id = 'askedPageSize';
                pageSize.className = 'border border-gray-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
                [6, 12, 24, 48].forEach(n => { const o = document.createElement('option'); o.value = String(n); o.textContent = String(n); pageSize.appendChild(o); });

                const copyBtn = document.createElement('button');
                copyBtn.type = 'button';
                copyBtn.className = 'ml-auto btn-primary text-white text-xs font-medium px-3 py-1 rounded';
                copyBtn.setAttribute('aria-label', 'Copy asked list');
                copyBtn.textContent = 'Copy';

                const exportBtn = document.createElement('button');
                exportBtn.type = 'button';
                exportBtn.className = 'px-2 py-1 text-xs border border-gray-300 rounded text-gray-700';
                exportBtn.textContent = 'Export';

                header.appendChild(title);
                header.appendChild(search);
                header.appendChild(sortBtn);
                header.appendChild(pageSizeLabel);
                header.appendChild(pageSize);
                header.appendChild(copyBtn);
                header.appendChild(exportBtn);

                const empty = document.createElement('div');
                empty.className = 'text-sm text-gray-500 mt-2';
                empty.textContent = 'No questions asked yet. Press Next to start.';

                const list = document.createElement('ul');
                list.setAttribute('role', 'list');
                list.className = 'flex-1 overflow-y-auto px-3 py-2';

                const footer = document.createElement('div');
                footer.className = 'sticky bottom-0 z-10 bg-white px-3 py-2 border-t flex items-center justify-between';
                const prevBtn = document.createElement('button');
                prevBtn.type = 'button';
                prevBtn.className = 'px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 disabled:opacity-50';
                prevBtn.textContent = 'Prev';
                prevBtn.setAttribute('data-asked-prev', '');
                const pageLabel = document.createElement('div');
                pageLabel.className = 'text-xs text-gray-600';
                pageLabel.textContent = 'Page 1 of 1';
                pageLabel.setAttribute('data-asked-page', '');
                const nextBtn = document.createElement('button');
                nextBtn.type = 'button';
                nextBtn.className = 'px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 disabled:opacity-50';
                nextBtn.textContent = 'Next';
                nextBtn.setAttribute('data-asked-next', '');
                footer.appendChild(prevBtn);
                footer.appendChild(pageLabel);
                footer.appendChild(nextBtn);

                const status = document.createElement('div');
                status.setAttribute('aria-live', 'polite');
                status.className = 'sr-only';
                status.setAttribute('data-asked-status', '');

                wrapper.appendChild(header);
                wrapper.appendChild(empty);
                wrapper.appendChild(list);
                wrapper.appendChild(footer);
                wrapper.appendChild(status);
                container.appendChild(wrapper);

                return { search, sortBtn, pageSize, copyBtn, exportBtn, empty, list, prevBtn, nextBtn, pageLabel, status };
        }

        function fmtDateTime(ts) {
                try {
                        const fmt = new Intl.DateTimeFormat('en-IE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Dublin' });
                        return fmt.format(new Date(ts));
                } catch { return ''; }
        }

        function renderList(container, state) {
                const wrapper = container.firstElementChild;
                const list = wrapper.querySelector('ul[role="list"]');
                const search = wrapper.querySelector('input[aria-label="Search asked questions"]');
                const empty = wrapper.querySelector('.text-sm.text-gray-500');
                const prevBtn = wrapper.querySelector('[data-asked-prev]');
                const nextBtn = wrapper.querySelector('[data-asked-next]');
                const pageLabel = wrapper.querySelector('[data-asked-page]');
                const status = wrapper.querySelector('[data-asked-status]');

                list.innerHTML = '';
                const filter = (search.value || '').toLowerCase();

                const tuplesAll = state.askedIds.map((id, idx) => ({ id, idx, ts: state.timestamps[idx] || 0 }));
                tuplesAll.sort((a, b) => state.sort === 'desc' ? (b.ts - a.ts) : (a.ts - b.ts));
                const tuples = tuplesAll.filter(t => {
                        const q = state.questionsById.get(t.id);
                        if (!q) return false;
                        const text = q.text || '';
                        return !filter || text.toLowerCase().includes(filter);
                });

                const totalItems = tuples.length;
                const totalPages = totalItems === 0 ? 1 : Math.max(1, Math.ceil(totalItems / state.pageSize));
                if (state.page < 1) state.page = 1;
                if (state.page > totalPages) state.page = totalPages;

                const start = (state.page - 1) * state.pageSize;
                const end = start + state.pageSize;
                const pageTuples = tuples.slice(start, end);

                pageTuples.forEach((t, i) => {
                        const q = state.questionsById.get(t.id);
                        if (!q) return;
                        const text = q.text || '';

                        const li = document.createElement('li');
                        li.setAttribute('role', 'listitem');
                        li.className = 'py-2 cursor-pointer hover:bg-gray-50 px-2 rounded';
                        li.dataset.id = t.id;
                        if (state.selectedId === t.id) li.classList.add('ring-1', 'ring-indigo-300');

                        const row = document.createElement('div');
                        row.className = 'flex items-center justify-between gap-2';
                        const left = document.createElement('div');
                        left.className = 'flex items-start gap-2';
                        const idxBadge = document.createElement('span');
                        idxBadge.className = 'text-xs text-gray-500 mt-0.5 w-6 text-right';
                        idxBadge.textContent = String(start + i + 1) + '.';
                        const textEl = document.createElement('div');
                        textEl.className = 'text-sm text-gray-700';
                        const truncated = text.length > 120 ? text.slice(0, 120) + '…' : text;
                        textEl.textContent = truncated;
                        left.appendChild(idxBadge);
                        left.appendChild(textEl);

                        const time = document.createElement('span');
                        time.className = 'text-[10px] text-gray-400';
                        time.textContent = fmtDateTime(t.ts);

                        row.appendChild(left);
                        row.appendChild(time);
                        li.appendChild(row);

                        const handler = () => {
                                state.selectedId = t.id;
                                state.onSelect && state.onSelect(t.id);
                                renderList(container, state);
                        };
                        li.addEventListener('click', handler);
                        list.appendChild(li);
                });

                empty.style.display = state.askedIds.length === 0 ? 'block' : 'none';
                if (state.askedIds.length > 0 && totalItems === 0) {
                        empty.style.display = 'block';
                        empty.textContent = 'No matches.';
                } else {
                        empty.textContent = 'No questions asked yet. Press Next to start.';
                }

                if (pageLabel) pageLabel.textContent = `Page ${state.page} of ${totalPages}`;
                if (prevBtn) prevBtn.disabled = state.page <= 1;
                if (nextBtn) nextBtn.disabled = state.page >= totalPages;
                if (status) status.textContent = `Page ${state.page} of ${totalPages}`;
        }

        const AskedList = {
                render(container, { askedIds = [], timestamps = [], questionsById, onSelect } = {}) {
                        const state = ensureInstance(container);
                        state.askedIds = Array.isArray(askedIds) ? askedIds.slice() : [];
                        state.timestamps = Array.isArray(timestamps) ? timestamps.slice() : [];
                        state.questionsById = questionsById instanceof Map ? questionsById : new Map(Object.entries(questionsById || {}).map(([k, v]) => [k, v]));
                        state.onSelect = typeof onSelect === 'function' ? onSelect : function() {};
                        state.selectedId = null;

                        const { search, sortBtn, pageSize, copyBtn, exportBtn, prevBtn, nextBtn } = buildLayout(container);

                        state.pageSize = getSavedPageSize();
                        pageSize.value = String(state.pageSize);
                        state.page = 1;

                        search.addEventListener('input', () => { state.page = 1; renderList(container, state); });
                        sortBtn.addEventListener('click', () => {
                                state.sort = state.sort === 'desc' ? 'asc' : 'desc';
                                sortBtn.textContent = state.sort === 'desc' ? 'Most recent' : 'Oldest';
                                renderList(container, state);
                        });
                        pageSize.addEventListener('change', () => {
                                const n = Number(pageSize.value);
                                state.pageSize = [6, 12, 24, 48].includes(n) ? n : 12;
                                savePageSize(state.pageSize);
                                state.page = 1;
                                renderList(container, state);
                        });
                        prevBtn.addEventListener('click', () => { if (state.page > 1) { state.page--; renderList(container, state); } });
                        nextBtn.addEventListener('click', () => { state.page++; renderList(container, state); });

                        copyBtn.addEventListener('click', async () => {
                                const text = AskedList.copyToClipboard(container);
                                try { if (navigator && navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text); } catch {}
                                AskedList.toast(container, `Copied ${state.askedIds.length} questions`);
                        });
                        exportBtn.addEventListener('click', () => {
                                AskedList.exportMenu(container);
                        });

                        renderList(container, state);
                },
                update(container, { askedIds, timestamps }) {
                        const state = ensureInstance(container);
                        if (Array.isArray(askedIds)) state.askedIds = askedIds.slice();
                        if (Array.isArray(timestamps)) state.timestamps = timestamps.slice();
                        renderList(container, state);
                },
                copyToClipboard(container) {
                        const state = ensureInstance(container);
                        const lines = state.askedIds.map((id, i) => {
                                const q = state.questionsById.get(id);
                                const dt = fmtDateTime(state.timestamps[i] || 0);
                                return q ? `${q.text || ''} — ${dt}` : '';
                        }).filter(Boolean);
                        return lines.join('\n');
                },
                exportMenu(container) {
                        const state = ensureInstance(container);
                        const name = (window.__activeSessionName || 'session');
                        const date = new Date().toISOString().slice(0,10);
                        const mdLines = state.askedIds.map((id, i) => {
                                const q = state.questionsById.get(id);
                                const dt = fmtDateTime(state.timestamps[i] || 0);
                                return q ? `${i+1}. ${q.text} — ${dt}` : '';
                        }).filter(Boolean);
                        const md = [`# Asked: ${name} (${date})`, ''].concat(mdLines).join('\n');
                        const csvLines = ['index,question,timestamp,datetime'].concat(state.askedIds.map((id, i) => {
                                const q = state.questionsById.get(id);
                                const t = state.timestamps[i] || 0;
                                const safe = q ? (q.text||'').replaceAll('"','""') : '';
                                const dt = fmtDateTime(t).replaceAll('"','""');
                                return `${i+1},"${safe}",${t},"${dt}"`;
                        })).join('\n');
                        function download(filename, text, type) {
                                const blob = new Blob([text], { type });
                                try {
                                        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = filename;
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                                if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
                                        }
                                } catch {}
                        }
                        download(`asked-${name}.md`, md, 'text/markdown');
                        download(`asked-${name}.csv`, csvLines, 'text/csv');
                        AskedList.toast(container, `Exported asked-${name}.md`);
                },
                toast(container, message) {
                        const toast = document.createElement('div');
                        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded shadow';
                        toast.textContent = message;
                        document.body.appendChild(toast);
                        setTimeout(() => { toast.remove(); }, 2000);
                }
        };

        if (typeof module !== 'undefined') module.exports = AskedList;
        if (typeof window !== 'undefined') window.AskedList = AskedList;
})();



