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
                        const deleteBtn = document.createElement('button');
                        deleteBtn.id = 'deleteSessionBtn';
                        deleteBtn.type = 'button';
                        deleteBtn.className = 'px-3 py-2 rounded border border-red-300 text-red-700 disabled:opacity-50';
                        deleteBtn.textContent = 'Delete';
                        deleteBtn.disabled = true;
                        select.addEventListener('change', () => { openBtn.disabled = !select.value; });
                        select.addEventListener('change', () => { deleteBtn.disabled = !select.value; });
                        openBtn.addEventListener('click', () => { if (select.value) state.onOpen && state.onOpen(select.value); });
                        // Enter on select opens
                        select.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter' && select.value) { e.preventDefault(); openBtn.click(); }
                        });
                        selectRow.appendChild(select);
                        selectRow.appendChild(openBtn);
                        selectRow.appendChild(deleteBtn);
                        panelExisting.appendChild(selectRow);

                        // Accessible centered delete modal
                        deleteBtn.addEventListener('click', () => {
                                const name = select.value;
                                if (!name) return;
                                const previouslyFocused = document.activeElement;
                                const overlay = document.createElement('div');
                                overlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50';
                                const dialog = document.createElement('div');
                                dialog.className = 'bg-white rounded-lg p-4 w-full max-w-sm shadow-lg';
                                dialog.setAttribute('role', 'dialog');
                                dialog.setAttribute('aria-modal', 'true');
                                dialog.setAttribute('aria-labelledby', 'delTitle');
                                dialog.tabIndex = -1;
                                dialog.innerHTML = `
                                        <h2 id=\"delTitle\" class=\"text-sm font-semibold mb-2\">Delete session</h2>
                                        <div class=\"text-sm mb-3\">Delete session <span class=\"font-semibold\">${name}</span>? This cannot be undone.</div>
                                        <div class=\"flex justify-end gap-2\">
                                                <button id=\"delCancel\" class=\"px-3 py-1 border border-gray-300 rounded\">Cancel</button>
                                                <button id=\"delConfirm\" class=\"btn-primary text-white px-3 py-1 rounded\">Delete</button>
                                        </div>`;
                                overlay.appendChild(dialog);
                                document.body.appendChild(overlay);
                                // prevent background scroll without layout shift
                                const prevOverflow = document.body.style.overflow;
                                const prevPaddingRight = document.body.style.paddingRight;
                                const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
                                if (scrollBarWidth > 0) {
                                        document.body.style.paddingRight = String(scrollBarWidth) + 'px';
                                }
                                document.body.style.overflow = 'hidden';

                                const cancelButton = dialog.querySelector('#delCancel');
                                const confirmButton = dialog.querySelector('#delConfirm');

                                // focus trap
                                const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
                                function getFocusable() {
                                        return Array.from(dialog.querySelectorAll(focusableSelectors)).filter(el => !el.disabled && el.offsetParent !== null);
                                }
                                function closeDialog({ restore = true } = {}) {
                                        overlay.remove();
                                        document.body.style.overflow = prevOverflow;
                                        document.body.style.paddingRight = prevPaddingRight;
                                        if (restore) {
                                                if (deleteBtn && typeof deleteBtn.focus === 'function' && !deleteBtn.disabled) {
                                                        try { deleteBtn.focus(); } catch {}
                                                } else if (select && typeof select.focus === 'function') {
                                                        try { select.focus(); } catch {}
                                                } else if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                                                        try { previouslyFocused.focus(); } catch {}
                                                }
                                        }
                                }
                                function onKeydown(e) {
                                        if (e.key === 'Escape') {
                                                e.preventDefault();
                                                closeDialog();
                                        } else if (e.key === 'Tab') {
                                                const focusables = getFocusable();
                                                if (focusables.length === 0) return;
                                                const first = focusables[0];
                                                const last = focusables[focusables.length - 1];
                                                if (e.shiftKey) {
                                                        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
                                                } else {
                                                        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
                                                }
                                        }
                                }
                                overlay.addEventListener('keydown', onKeydown);

                                cancelButton.addEventListener('click', () => closeDialog());
                                confirmButton.addEventListener('click', () => {
                                        closeDialog({ restore: false });
                                        if (window.SessionStore && typeof window.SessionStore.remove === 'function') {
                                                window.SessionStore.remove(name);
                                                select.value = '';
                                                openBtn.disabled = true;
                                                deleteBtn.disabled = true;
                                                SessionPicker.updateSessions(container, window.SessionStore.getAll());
                                        }
                                        if (typeof window.__activeSessionName === 'string' && window.__activeSessionName === name) {
                                                const ev = new CustomEvent('session-deleted', { detail: { name } });
                                                window.dispatchEvent(ev);
                                        }
                                        if (window.AskedList && typeof window.AskedList.toast === 'function') {
                                                window.AskedList.toast(document.body, `Deleted session ${name}`);
                                        } else {
                                                const toast = document.createElement('div');
                                                toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded shadow';
                                                toast.textContent = `Deleted session ${name}`;
                                                document.body.appendChild(toast);
                                                setTimeout(() => { toast.remove(); }, 2000);
                                        }
                                        if (select && typeof select.focus === 'function') { try { select.focus(); } catch {} }
                                });

                                // initial focus into dialog
                                setTimeout(() => { try { cancelButton.focus(); } catch {} }, 0);
                        });

                        const panelNew = document.createElement('div');
                        panelNew.setAttribute('role', 'tabpanel');
                        panelNew.setAttribute('aria-labelledby', 'tab-new');
                        panelNew.className = 'hidden';
                        // Inline create form (no toggle button)
                        const formRow = document.createElement('div');
                        formRow.className = 'flex items-center gap-2';
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
                        input.addEventListener('input', () => {
                                const trimmed = (input.value || '').trim();
                                createBtn.disabled = !trimmed || (window.SessionStore && window.SessionStore.exists(trimmed));
                        });
                        function submitCreate() {
                                const name = (input.value || '').trim();
                                if (!name) return;
                                state.onCreate && state.onCreate(name);
                                input.value = '';
                                createBtn.disabled = true;
                        }
                        createBtn.addEventListener('click', submitCreate);
                        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !createBtn.disabled) { e.preventDefault(); submitCreate(); } });
                        formRow.appendChild(input);
                        formRow.appendChild(createBtn);
                        panelNew.appendChild(formRow);

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

                        // Default to New tab if no sessions exist; otherwise Existing
                        if (state.sessions.length === 0) {
                                activate('new');
                                setTimeout(() => { try { input.focus(); } catch {} }, 0);
                        } else {
                                activate('existing');
                        }
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
                                none.textContent = '— Select session —';
                                select.appendChild(none);
                                state.sessions.forEach(name => {
                                        const opt = document.createElement('option');
                                        opt.value = name;
                                        opt.textContent = name;
                                        select.appendChild(opt);
                                });
                                if (state.sessions.includes(current)) select.value = current;
                        }
                        // If no sessions remain, switch UI to New tab
                        if (state.sessions.length === 0) {
                                const tabExisting = container.querySelector('#tab-existing');
                                const tabNew = container.querySelector('#tab-new');
                                const panelExisting = container.querySelector('[role="tabpanel"][aria-labelledby="tab-existing"]');
                                const panelNew = container.querySelector('[role="tabpanel"][aria-labelledby="tab-new"]');
                                if (tabExisting && tabNew && panelExisting && panelNew) {
                                        tabExisting.setAttribute('aria-selected', 'false');
                                        tabExisting.className = 'px-3 py-1.5 text-sm text-gray-600';
                                        tabNew.setAttribute('aria-selected', 'true');
                                        tabNew.className = 'px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700';
                                        panelExisting.classList.add('hidden');
                                        panelNew.classList.remove('hidden');
                                }
                        }
                }
        };

        if (typeof module !== 'undefined') module.exports = SessionPicker;
        if (typeof window !== 'undefined') window.SessionPicker = SessionPicker;
})();



