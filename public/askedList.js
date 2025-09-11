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
                        };
                }
                return container._askedListInstance;
        }

        function buildLayout(container) {
                container.innerHTML = '';
                const wrapper = document.createElement('div');
                wrapper.className = 'bg-white rounded-xl shadow p-4 h-full flex flex-col';

                const header = document.createElement('div');
                header.className = 'flex items-center justify-between mb-3';
                const title = document.createElement('h2');
                title.className = 'text-lg font-semibold';
                title.textContent = 'Asked in this session';

                const tools = document.createElement('div');
                tools.className = 'flex items-center gap-2';

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

                const copyBtn = document.createElement('button');
                copyBtn.type = 'button';
                copyBtn.className = 'btn-primary text-white text-sm font-medium px-3 py-1 rounded';
                copyBtn.setAttribute('aria-label', 'Copy asked list');
                copyBtn.textContent = 'Copy list';

                const exportBtn = document.createElement('button');
                exportBtn.type = 'button';
                exportBtn.className = 'px-2 py-1 text-xs border border-gray-300 rounded text-gray-700';
                exportBtn.textContent = 'Export';

                tools.appendChild(search);
                tools.appendChild(sortBtn);
                tools.appendChild(copyBtn);
                tools.appendChild(exportBtn);

                header.appendChild(title);
                header.appendChild(tools);

                const empty = document.createElement('div');
                empty.className = 'text-sm text-gray-500 mt-2';
                empty.textContent = 'No questions asked yet. Press Next to start.';

                const list = document.createElement('ul');
                list.setAttribute('role', 'list');
                list.className = 'divide-y divide-gray-100 overflow-auto';

                wrapper.appendChild(header);
                wrapper.appendChild(empty);
                wrapper.appendChild(list);
                container.appendChild(wrapper);

                return { search, sortBtn, copyBtn, exportBtn, empty, list };
        }

        function fmtTime(ts) {
                try {
                        const d = new Date(ts);
                        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch { return ''; }
        }

        function renderList(container, state) {
                const parts = container.querySelectorAll('ul[role="list"], input[aria-label="Search asked questions"], .text-sm.text-gray-500');
                const list = parts[0] && parts[0].tagName === 'UL' ? parts[0] : container.querySelector('ul[role="list"]');
                const search = container.querySelector('input[aria-label="Search asked questions"]');
                const empty = container.querySelector('.text-sm.text-gray-500');

                list.innerHTML = '';
                const filter = (search.value || '').toLowerCase();
                let visibleCount = 0;

                const tuples = state.askedIds.map((id, idx) => ({ id, idx, ts: state.timestamps[idx] || 0 }));
                tuples.sort((a, b) => state.sort === 'desc' ? (b.ts - a.ts) : (a.ts - b.ts));

                tuples.forEach((t, i) => {
                        const q = state.questionsById.get(t.id);
                        if (!q) return;
                        const text = q.text || '';
                        if (filter && !text.toLowerCase().includes(filter)) return;
                        visibleCount++;
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
                        idxBadge.textContent = String(i + 1) + '.';
                        const textEl = document.createElement('div');
                        textEl.className = 'text-sm text-gray-700';
                        const truncated = text.length > 120 ? text.slice(0, 120) + '…' : text;
                        textEl.textContent = truncated;
                        left.appendChild(idxBadge);
                        left.appendChild(textEl);

                        const time = document.createElement('span');
                        time.className = 'text-[10px] text-gray-400';
                        time.textContent = fmtTime(t.ts);

                        row.appendChild(left);
                        row.appendChild(time);
                        li.appendChild(row);

                        li.addEventListener('click', () => {
                                state.selectedId = t.id;
                                state.onSelect && state.onSelect(t.id);
                                renderList(container, state);
                        });
                        list.appendChild(li);
                });

                empty.style.display = state.askedIds.length === 0 ? 'block' : 'none';

                // If search reduces to zero
                if (state.askedIds.length > 0 && visibleCount === 0) {
                        empty.style.display = 'block';
                        empty.textContent = 'No matches.';
                } else {
                        empty.textContent = 'No questions asked yet. Press Next to start.';
                }
        }

        const AskedList = {
                render(container, { askedIds = [], timestamps = [], questionsById, onSelect } = {}) {
                        const state = ensureInstance(container);
                        state.askedIds = Array.isArray(askedIds) ? askedIds.slice() : [];
                        state.timestamps = Array.isArray(timestamps) ? timestamps.slice() : [];
                        state.questionsById = questionsById instanceof Map ? questionsById : new Map(Object.entries(questionsById || {}).map(([k, v]) => [k, v]));
                        state.onSelect = typeof onSelect === 'function' ? onSelect : function() {};
                        state.selectedId = null;

                        const { search, sortBtn, copyBtn, exportBtn } = buildLayout(container);

                        search.addEventListener('input', () => renderList(container, state));
                        sortBtn.addEventListener('click', () => {
                                state.sort = state.sort === 'desc' ? 'asc' : 'desc';
                                sortBtn.textContent = state.sort === 'desc' ? 'Most recent' : 'Oldest';
                                renderList(container, state);
                        });
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
                        const lines = state.askedIds.map(id => {
                                const q = state.questionsById.get(id);
                                return q ? (q.text || '') : '';
                        }).filter(Boolean);
                        return lines.join('\n');
                },
                exportMenu(container) {
                        const state = ensureInstance(container);
                        const name = (window.__activeSessionName || 'session');
                        const date = new Date().toISOString().slice(0,10);
                        const mdLines = state.askedIds.map((id, i) => {
                                const q = state.questionsById.get(id);
                                return q ? `${i+1}. ${q.text}` : '';
                        }).filter(Boolean);
                        const md = [`# Asked: ${name} (${date})`, ''].concat(mdLines).join('\n');
                        const csvLines = ['index,question,timestamp'].concat(state.askedIds.map((id, i) => {
                                const q = state.questionsById.get(id);
                                const t = state.timestamps[i] || 0;
                                const safe = q ? (q.text||'').replaceAll('"','""') : '';
                                return `${i+1},"${safe}",${t}`;
                        })).join('\n');
                        function download(filename, text, type) {
                                const blob = new Blob([text], { type });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                URL.revokeObjectURL(url);
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



