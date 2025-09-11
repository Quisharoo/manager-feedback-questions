(function() {
        function ensure(container) {
                if (!container._sessionPicker) {
                        container._sessionPicker = { sessions: [], onOpen: function() {}, onCreate: function() {} };
                }
                return container._sessionPicker;
        }

        function renderCollapsedCreateArea(container, state) {
                const area = document.createElement('div');
                area.className = 'flex items-center gap-2';
                const toggleBtn = document.createElement('button');
                toggleBtn.type = 'button';
                toggleBtn.className = 'btn-primary text-white font-semibold px-4 py-2 rounded';
                toggleBtn.setAttribute('aria-label', 'New session');
                toggleBtn.textContent = 'New session';

                const form = document.createElement('div');
                form.className = 'hidden items-center gap-2';
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'e.g., 1:1 with Alex';
                input.className = 'border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400';
                input.setAttribute('aria-label', 'New session name');
                const createBtn = document.createElement('button');
                createBtn.type = 'button';
                createBtn.className = 'btn-primary text-white font-semibold px-4 py-2 rounded disabled:opacity-50';
                createBtn.textContent = 'Create';
                createBtn.disabled = true;
                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'px-3 py-2 rounded border border-gray-300 text-gray-700';
                cancelBtn.textContent = 'Cancel';

                form.appendChild(input);
                form.appendChild(createBtn);
                form.appendChild(cancelBtn);

                toggleBtn.addEventListener('click', () => {
                        form.classList.remove('hidden');
                        toggleBtn.classList.add('hidden');
                        input.focus();
                });
                cancelBtn.addEventListener('click', () => {
                        form.classList.add('hidden');
                        toggleBtn.classList.remove('hidden');
                        input.value = '';
                        createBtn.disabled = true;
                });
                input.addEventListener('input', () => {
                        const trimmed = (input.value || '').trim();
                        createBtn.disabled = !trimmed || (window.SessionStore && window.SessionStore.exists(trimmed));
                });
                createBtn.addEventListener('click', () => {
                        const name = (input.value || '').trim();
                        if (!name) return;
                        state.onCreate && state.onCreate(name);
                        input.value = '';
                        createBtn.disabled = true;
                        form.classList.add('hidden');
                        toggleBtn.classList.remove('hidden');
                });

                area.appendChild(toggleBtn);
                area.appendChild(form);
                return area;
        }

        const SessionPicker = {
                render(container, { sessions = [], onOpen, onCreate } = {}) {
                        const state = ensure(container);
                        state.sessions = Array.isArray(sessions) ? sessions.slice() : [];
                        state.onOpen = typeof onOpen === 'function' ? onOpen : function() {};
                        state.onCreate = typeof onCreate === 'function' ? onCreate : function() {};

                        container.innerHTML = '';
                        const card = document.createElement('div');
                        card.className = 'bg-white rounded-xl shadow p-4';

                        // Segmented control as tablist
                        const tablist = document.createElement('div');
                        tablist.setAttribute('role', 'tablist');
                        tablist.className = 'inline-flex rounded-lg border border-gray-200 overflow-hidden mb-3';
                        const tabExisting = document.createElement('button');
                        tabExisting.setAttribute('role', 'tab');
                        tabExisting.id = 'tab-existing';
                        tabExisting.className = 'px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700';
                        tabExisting.setAttribute('aria-selected', 'true');
                        tabExisting.textContent = 'Existing';
                        const tabNew = document.createElement('button');
                        tabNew.setAttribute('role', 'tab');
                        tabNew.id = 'tab-new';
                        tabNew.className = 'px-3 py-1.5 text-sm text-gray-600';
                        tabNew.setAttribute('aria-selected', 'false');
                        tabNew.textContent = 'New';
                        tablist.appendChild(tabExisting);
                        tablist.appendChild(tabNew);

                        // Panels
                        const panelExisting = document.createElement('div');
                        panelExisting.setAttribute('role', 'tabpanel');
                        panelExisting.setAttribute('aria-labelledby', 'tab-existing');
                        const selectRow = document.createElement('div');
                        selectRow.className = 'flex items-center gap-2';
                        const select = document.createElement('select');
                        select.id = 'sessionSelect';
                        select.className = 'flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400';
                        const none = document.createElement('option');
                        none.value = '';
                        none.textContent = '— Select session —';
                        select.appendChild(none);
                        state.sessions.forEach(name => {
                                const opt = document.createElement('option');
                                opt.value = name;
                                opt.textContent = name;
                                select.appendChild(opt);
                        });
                        const openBtn = document.createElement('button');
                        openBtn.id = 'openSessionBtn';
                        openBtn.type = 'button';
                        openBtn.className = 'btn-primary text-white font-semibold px-4 py-2 rounded disabled:opacity-50';
                        openBtn.textContent = 'Open session';
                        openBtn.disabled = true;
                        select.addEventListener('change', () => { openBtn.disabled = !select.value; });
                        openBtn.addEventListener('click', () => { if (select.value) state.onOpen && state.onOpen(select.value); });
                        // Enter on select opens
                        select.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter' && select.value) { e.preventDefault(); openBtn.click(); }
                        });
                        selectRow.appendChild(select);
                        selectRow.appendChild(openBtn);
                        panelExisting.appendChild(selectRow);

                        const panelNew = document.createElement('div');
                        panelNew.setAttribute('role', 'tabpanel');
                        panelNew.setAttribute('aria-labelledby', 'tab-new');
                        panelNew.className = 'hidden';
                        const newArea = renderCollapsedCreateArea(container, state);
                        // Esc cancels create form if visible
                        newArea.addEventListener('keydown', (e) => {
                                if (e.key === 'Escape') {
                                        const cancel = newArea.querySelector('button:contains("Cancel")');
                                        // Fallback: trigger first button with text Cancel
                                        const btn = Array.from(newArea.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
                                        if (btn) btn.click();
                                }
                        });
                        panelNew.appendChild(newArea);

                        const helper = document.createElement('div');
                        helper.className = 'text-xs text-gray-500 mt-2';
                        helper.textContent = 'Pick an existing session or create a new one.';

                        // Tab interactions
                        function activate(which) {
                                const isExisting = which === 'existing';
                                tabExisting.setAttribute('aria-selected', String(isExisting));
                                tabExisting.className = isExisting ? 'px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700' : 'px-3 py-1.5 text-sm text-gray-600';
                                tabNew.setAttribute('aria-selected', String(!isExisting));
                                tabNew.className = !isExisting ? 'px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700' : 'px-3 py-1.5 text-sm text-gray-600';
                                panelExisting.classList[isExisting ? 'remove' : 'add']('hidden');
                                panelNew.classList[!isExisting ? 'remove' : 'add']('hidden');
                        }
                        tabExisting.addEventListener('click', () => activate('existing'));
                        tabNew.addEventListener('click', () => activate('new'));

                        card.appendChild(tablist);
                        card.appendChild(panelExisting);
                        card.appendChild(panelNew);
                        card.appendChild(helper);
                        container.appendChild(card);
                },
                updateSessions(container, sessions) {
                        const state = ensure(container);
                        state.sessions = Array.isArray(sessions) ? sessions.slice() : [];
                        const select = container.querySelector('#sessionSelect');
                        if (select) {
                                const current = select.value;
                                select.innerHTML = '';
                                const none = document.createElement('option');
                                none.value = '';
                                none.textContent = '— None —';
                                select.appendChild(none);
                                state.sessions.forEach(name => {
                                        const opt = document.createElement('option');
                                        opt.value = name;
                                        opt.textContent = name;
                                        select.appendChild(opt);
                                });
                                if (state.sessions.includes(current)) select.value = current;
                        }
                }
        };

        if (typeof module !== 'undefined') module.exports = SessionPicker;
        if (typeof window !== 'undefined') window.SessionPicker = SessionPicker;
})();



