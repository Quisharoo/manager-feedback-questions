/**
 * Dialog Management Module
 * Handles all dialog/modal UI components including session creation, admin panels, and share links
 */
(function(global) {
    'use strict';

    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Helper function to unlock the app UI after session selection
    function unlockApp() {
        try {
            const askedContainer = document.getElementById('asked-container');
            const nextBtn = document.getElementById('nextBtn');
            const undoBtn = document.getElementById('undoBtn');
            const resetBtn = document.getElementById('resetBtn');
            const questionCard = document.querySelector('.question-card');
            const resultsBtn = document.getElementById('resultsBtn');

            if (askedContainer) askedContainer.classList.remove('hidden');
            if (nextBtn) nextBtn.classList.remove('hidden');
            if (undoBtn) undoBtn.classList.remove('hidden');
            if (resetBtn) resetBtn.classList.remove('hidden');

            // Ensure results button exists and is visible
            if (typeof window.ensureResultsButton === 'function') {
                window.ensureResultsButton();
            }
            if (resultsBtn) resultsBtn.classList.remove('hidden');
            if (questionCard) questionCard.classList.remove('hidden');

            // BUG FIX #2: Keep admin sessions button visible if in admin mode
            const isAdminMode = window.location.href.includes('admin=1');
            const adminSessionsBtn = document.getElementById('adminSessionsBtn');
            if (adminSessionsBtn) {
                if (isAdminMode) {
                    // Ensure button stays visible in admin mode
                    adminSessionsBtn.classList.remove('hidden');
                    adminSessionsBtn.style.display = 'block';
                    adminSessionsBtn.style.visibility = 'visible';
                } else {
                    // Hide in non-admin mode
                    adminSessionsBtn.classList.add('hidden');
                }
            }
        } catch (err) {
            console.error('unlockApp error:', err);
        }

        const overlay = document.getElementById('sessionGateOverlay');
        if (overlay) {
            if (typeof overlay._restore === 'function') {
                try { overlay._restore(); } catch {}
            }
            overlay.remove();
        }
    }

    // API wrapper functions
    async function validateAdminKey(key) {
        const api = (typeof window !== 'undefined' && window.SessionApi) || {};
        if (typeof api.fetchAdminSessions !== 'function') {
            throw new Error('Session API unavailable');
        }
        return api.fetchAdminSessions(key);
    }

    async function deleteAdminSession(id, adminKey) {
        const api = (typeof window !== 'undefined' && window.SessionApi) || {};
        if (typeof api.deleteAdminSession !== 'function') {
            throw new Error('Session API unavailable');
        }
        return api.deleteAdminSession(id, adminKey);
    }

    // Dialog: Create Session
    function showCreateSessionDialog() {
        if (document.getElementById('createSessionOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'createSessionOverlay';
        overlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50';
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-lg p-6 w-full max-w-md shadow-lg';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'createTitle');
        dialog.tabIndex = -1;
        dialog.innerHTML = `
            <h2 id="createTitle" class="text-xl font-semibold mb-2">Create a Session</h2>
            <p class="text-sm text-gray-600 mb-4">Give your session a name to get started. You'll receive a unique shareable link.</p>
            <label class="block text-sm font-medium text-gray-700 mb-2" for="sessionNameInput">Session name</label>
            <input id="sessionNameInput" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="e.g., 1:1 with Alex">
            <div class="flex justify-end gap-2">
                <button id="createSessionBtn" class="btn-primary text-white font-semibold px-6 py-2 rounded-lg disabled:opacity-50" disabled>Create</button>
            </div>
        `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const prevOverflow = document.body.style.overflow;
        const prevPaddingRight = document.body.style.paddingRight;
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollBarWidth > 0) {
            document.body.style.paddingRight = String(scrollBarWidth) + 'px';
        }
        document.body.style.overflow = 'hidden';

        const input = dialog.querySelector('#sessionNameInput');
        const createBtn = dialog.querySelector('#createSessionBtn');
        if (input) {
            input.setAttribute('aria-label', 'New session name');
        }

        input.addEventListener('input', () => {
            createBtn.disabled = !input.value.trim();
        });

        async function createSession() {
            const name = input.value.trim();
            if (!name) return;

            if (typeof showLoading === 'function') showLoading('Creating session...');
            try {
                const api = (typeof window !== 'undefined' && window.SessionApi) || {};
                if (typeof api.createCapabilitySession !== 'function') {
                    throw new Error('Session API unavailable');
                }
                const result = await api.createCapabilitySession(name);
                const links = result && result.links ? result.links : null;
                if (!links || !links.edit) {
                    throw new Error('Capability link not returned');
                }

                // Remove the create session overlay before showing share links
                if (typeof overlay._restore === 'function') {
                    overlay._restore();
                }
                overlay.remove();

                openShareLinksDialog(links);
            } catch (e) {
                console.error('Failed to create session:', e);
                toast(`Failed to create session: ${e && e.message ? e.message : 'Unknown error'}`, { type: 'error', duration: 4000 });
            } finally {
                if (typeof hideLoading === 'function') hideLoading();
            }
        }

        createBtn.addEventListener('click', createSession);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !createBtn.disabled) {
                e.preventDefault();
                createSession();
            }
        });

        // Can't close the dialog - must create a session
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); }
        });

        overlay._restore = () => {
            document.body.style.overflow = prevOverflow;
            document.body.style.paddingRight = prevPaddingRight;
        };

        setTimeout(() => { try { input.focus(); } catch {} }, 100);
    }

    // Dialog: Session Gate (admin mode session picker)
    function showSessionGate() {
        if (document.getElementById('sessionGateOverlay')) return;

        // Only show in admin mode - regular users access via capability links
        const isAdminMode = (() => {
            try {
                const params = new URLSearchParams(window.location.search);
                return params.get('admin') === '1';
            } catch {
                return false;
            }
        })();

        if (!isAdminMode) {
            console.error('Session gate should only be called in admin mode');
            return;
        }

        // Admin mode: show session management panel
        const overlay = document.createElement('div');
        overlay.id = 'sessionGateOverlay';
        overlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50';
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-lg p-4 w-full max-w-2xl shadow-lg';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'gateTitle');
        dialog.tabIndex = -1;
        dialog.innerHTML = `
            <h2 id="gateTitle" class="text-lg font-semibold mb-2">Start a session</h2>
            <p id="gateHelper" class="text-sm text-gray-600 mb-3">Pick an existing session or create a new one to begin.</p>
            <div id="sessionGateHost"></div>
        `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const prevOverflow = document.body.style.overflow;
        const prevPaddingRight = document.body.style.paddingRight;
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollBarWidth > 0) {
            document.body.style.paddingRight = String(scrollBarWidth) + 'px';
        }
        document.body.style.overflow = 'hidden';

        const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        function getFocusable() {
            return Array.from(dialog.querySelectorAll(focusableSelectors)).filter(el => !el.disabled && el.offsetParent !== null);
        }
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
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
            if (e.key === 'Escape') { e.preventDefault(); }
        });

        // Dynamic helper text for admin mode
        try {
            const gateHelper = dialog.querySelector('#gateHelper');
            gateHelper.textContent = 'Manage existing sessions or create new ones.';
        } catch {}

        const host = dialog.querySelector('#sessionGateHost');
        if (typeof window.renderSessionPickerInto === 'function') {
            window.renderSessionPickerInto(host);
        }
        setTimeout(() => {
            try {
                const first = getFocusable()[0];
                if (first) first.focus();
            } catch {}
        }, 0);

        overlay._restore = () => {
            document.body.style.overflow = prevOverflow;
            document.body.style.paddingRight = prevPaddingRight;
        };
    }

    // Dialog: Admin Sessions Panel (floating panel showing all sessions)
    function showAdminSessionsPanel(sessions, adminKey) {
        // Remove existing panel if any
        const existing = document.getElementById('adminSessionsPanel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'adminSessionsPanel';
        panel.className = 'fixed bottom-20 right-6 bg-white rounded-lg shadow-xl border border-gray-200 w-96 max-h-96 overflow-hidden flex flex-col';
        panel.style.zIndex = '50';

        const header = document.createElement('div');
        header.className = 'p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50';
        header.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-gray-700">Server Sessions</span>
                <span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${sessions.length}</span>
            </div>
            <button id="adminPanelClose" class="text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
            </button>
        `;

        const listContainer = document.createElement('div');
        listContainer.className = 'overflow-y-auto flex-1';

        if (sessions.length === 0) {
            listContainer.innerHTML = `
                <div class="p-4 text-center text-gray-500 text-sm">
                    <div class="mb-2"><i class="fas fa-info-circle"></i></div>
                    <div>No sessions yet. Create one to get started!</div>
                </div>
            `;
        } else {
            const sortedSessions = [...sessions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            sortedSessions.forEach(session => {
                const item = document.createElement('div');
                item.className = 'p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors';
                item.innerHTML = `
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium text-gray-900 truncate">${escapeHtml(session.name)}</div>
                            <div class="text-xs text-gray-500 mt-1">
                                <div>Created: ${formatTimestamp(session.createdAt)}</div>
                                <div>Last access: ${formatTimestamp(session.lastAccess)}</div>
                            </div>
                        </div>
                        <button class="admin-delete-session text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50" data-session-id="${escapeHtml(session.id)}" title="Delete session">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="mt-2 text-xs text-gray-400 font-mono truncate" title="${escapeHtml(session.id)}">ID: ${escapeHtml(session.id)}</div>
                `;
                listContainer.appendChild(item);
            });
        }

        const footer = document.createElement('div');
        footer.className = 'p-2 border-t border-gray-200 bg-yellow-50';
        footer.innerHTML = `
            <div class="text-xs text-yellow-800 flex items-start gap-2">
                <i class="fas fa-exclamation-triangle mt-0.5"></i>
                <div>Session links are only shown once at creation. Save them when creating sessions!</div>
            </div>
        `;

        panel.appendChild(header);
        panel.appendChild(listContainer);
        panel.appendChild(footer);
        document.body.appendChild(panel);

        // Event handlers
        const closeBtn = header.querySelector('#adminPanelClose');
        closeBtn.addEventListener('click', () => panel.remove());

        // Delete session handlers
        const deleteButtons = listContainer.querySelectorAll('.admin-delete-session');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sessionId = btn.dataset.sessionId;
                const sessionItem = btn.closest('.p-3');
                const sessionName = sessionItem.querySelector('.text-sm').textContent;

                // Create confirmation dialog
                const confirmOverlay = document.createElement('div');
                confirmOverlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50';
                const confirmDialog = document.createElement('div');
                confirmDialog.className = 'bg-white rounded-lg p-4 w-full max-w-sm shadow-lg';
                confirmDialog.setAttribute('role', 'dialog');
                confirmDialog.setAttribute('aria-modal', 'true');
                confirmDialog.innerHTML = `
                    <h2 class="text-sm font-semibold mb-2">Delete session</h2>
                    <div class="text-sm mb-3">Delete session "${escapeHtml(sessionName)}"? This cannot be undone.</div>
                    <div class="flex justify-end gap-2">
                        <button id="adminDeleteCancel" class="px-3 py-1 border border-gray-300 rounded">Cancel</button>
                        <button id="adminDeleteConfirm" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">Delete</button>
                    </div>
                `;
                confirmOverlay.appendChild(confirmDialog);
                document.body.appendChild(confirmOverlay);

                const cancelBtn = confirmDialog.querySelector('#adminDeleteCancel');
                const confirmBtn = confirmDialog.querySelector('#adminDeleteConfirm');

                cancelBtn.addEventListener('click', () => confirmOverlay.remove());
                confirmBtn.addEventListener('click', async () => {
                    confirmOverlay.remove();
                    showLoading('Deleting session...');
                    try {
                        await deleteAdminSession(sessionId, adminKey);
                        toast('Session deleted', { type: 'success' });
                        // Refresh the panel
                        const json = await validateAdminKey(adminKey);
                        showAdminSessionsPanel(json.sessions || [], adminKey);
                    } catch (err) {
                        toast('Failed to delete session', { type: 'error' });
                        console.error('Delete failed:', err);
                    } finally {
                        hideLoading();
                    }
                });

                setTimeout(() => { try { cancelBtn.focus(); } catch {} }, 0);
            });
        });
    }

    // Dialog: Share Links (shown after creating a session)
    function openShareLinksDialog(links) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50';
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-xl p-6 w-full max-w-xl shadow-2xl border-4 border-amber-400';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'shareTitle');
        dialog.tabIndex = -1;
        const editLink = (links && links.edit) || '';
        const viewLink = (links && links.view) || '';
        dialog.innerHTML = `
            <div class="text-center mb-4">
                <div class="inline-block bg-amber-100 rounded-full p-3 mb-3">
                    <i class="fas fa-exclamation-triangle text-amber-600 text-3xl"></i>
                </div>
                <h2 id="shareTitle" class="text-xl font-bold text-gray-900 mb-2">Session Created Successfully!</h2>
                <div class="bg-amber-50 border-l-4 border-amber-500 p-3 rounded text-left">
                    <p class="text-sm font-semibold text-amber-900 flex items-center gap-2">
                        <i class="fas fa-info-circle"></i>
                        IMPORTANT: Save these links now!
                    </p>
                    <p class="text-xs text-amber-800 mt-1">
                        These capability links cannot be recovered. Copy and save them before closing this dialog.
                    </p>
                </div>
            </div>
            <label class="block text-sm font-semibold text-gray-900 mb-2">
                <i class="fas fa-edit mr-1 text-indigo-600"></i> Edit Link (Full Access)
            </label>
            <div class="flex gap-2 mb-4">
                <input id="shareEditInput" class="flex-1 w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none" value="${editLink.replace(/"/g, '&quot;')}" readonly>
                <button id="copyEdit" class="px-4 py-2 text-sm btn-primary text-white rounded-lg font-semibold hover:shadow-lg transition-all">
                    <i class="fas fa-copy mr-1"></i> Copy
                </button>
                <a id="openEdit" class="px-4 py-2 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all flex items-center" href="${editLink}" target="_blank" rel="noopener">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
            <label class="block text-sm font-semibold text-gray-900 mb-2">
                <i class="fas fa-eye mr-1 text-green-600"></i> View-Only Link
            </label>
            <div class="flex gap-2 mb-5">
                <input id="shareViewInput" class="flex-1 w-full border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none" value="${viewLink.replace(/"/g, '&quot;')}" readonly>
                <button id="copyView" class="px-4 py-2 text-sm btn-primary text-white rounded-lg font-semibold hover:shadow-lg transition-all">
                    <i class="fas fa-copy mr-1"></i> Copy
                </button>
                <a id="openView" class="px-4 py-2 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all flex items-center" href="${viewLink}" target="_blank" rel="noopener">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
            <div class="border-t pt-4 flex items-center justify-end gap-3">
                <button id="shareClose" class="px-6 py-2 btn-primary text-white rounded-lg font-semibold hover:shadow-lg transition-all">
                    <i class="fas fa-arrow-right mr-2"></i>Open Session
                </button>
            </div>
        `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Prevent scrolling while dialog is open (will be cleaned up on navigation)
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollBarWidth > 0) document.body.style.paddingRight = String(scrollBarWidth) + 'px';
        document.body.style.overflow = 'hidden';

        function bindCopy(btnId, inputId) {
            const btn = dialog.querySelector(btnId);
            const input = dialog.querySelector(inputId);
            if (!btn || !input) return;
            btn.addEventListener('click', async () => {
                const originalText = btn.innerHTML;
                try {
                    await navigator.clipboard.writeText(input.value || '');
                    // Success animation
                    btn.innerHTML = '<i class="fas fa-check mr-1"></i> Copied!';
                    btn.classList.add('bg-green-600');
                    toast('Link copied to clipboard', { type: 'success' });
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.classList.remove('bg-green-600');
                    }, 2000);
                } catch {
                    try {
                        input.select();
                        document.execCommand('copy');
                        btn.innerHTML = '<i class="fas fa-check mr-1"></i> Copied!';
                        btn.classList.add('bg-green-600');
                        toast('Link copied to clipboard', { type: 'success' });
                        setTimeout(() => {
                            btn.innerHTML = originalText;
                            btn.classList.remove('bg-green-600');
                        }, 2000);
                    } catch {}
                }
            });
        }
        bindCopy('#copyEdit', '#shareEditInput');
        bindCopy('#copyView', '#shareViewInput');

        const closeBtn = dialog.querySelector('#shareClose');
        closeBtn.addEventListener('click', () => {
            // Navigate to the edit link
            window.location.href = editLink;
        });

        // Auto-select first input for easy copying
        setTimeout(() => {
            try {
                const editInput = dialog.querySelector('#shareEditInput');
                if (editInput) editInput.focus();
            } catch {}
        }, 100);
    }

    // Dialog: Create Server Session (admin mode)
    function openCreateServerSessionDialog(adminKey) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50';
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-lg p-4 w-full max-w-sm shadow-lg';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'createTitle');
        dialog.tabIndex = -1;
        dialog.innerHTML = `
            <h2 id="createTitle" class="text-sm font-semibold mb-2">Create server session</h2>
            <label class="block text-xs text-gray-700 mb-1" for="createName">Session name</label>
            <input id="createName" class="w-full border border-gray-300 rounded px-3 py-2 mb-3" placeholder="e.g., Weekly 1:1 - Alice">
            <div class="flex justify-end gap-2">
                <button id="createCancel" class="px-3 py-1 border border-gray-300 rounded">Cancel</button>
                <button id="createConfirm" class="btn-primary text-white px-3 py-1 rounded">Create</button>
            </div>
        `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        const prevOverflow = document.body.style.overflow;
        const prevPaddingRight = document.body.style.paddingRight;
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollBarWidth > 0) document.body.style.paddingRight = String(scrollBarWidth) + 'px';
        document.body.style.overflow = 'hidden';
        function close() {
            overlay.remove();
            document.body.style.overflow = prevOverflow;
            document.body.style.paddingRight = prevPaddingRight;
        }
        const input = dialog.querySelector('#createName');
        const cancelBtn = dialog.querySelector('#createCancel');
        const confirmBtn = dialog.querySelector('#createConfirm');
        cancelBtn.addEventListener('click', () => close());
        confirmBtn.addEventListener('click', async () => {
            const name = (input.value || '').trim();
            if (!name) return;
            showLoading('Creating session...');
            try {
                const res = await fetch('/api/admin/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Key ' + adminKey },
                    body: JSON.stringify({ name })
                });
                if (!res.ok) throw new Error('Failed');
                const json = await res.json();
                hideLoading();
                close();
                toast('Session created successfully', { type: 'success' });
                if (json && json.links) openShareLinksDialog(json.links);
                // Refresh the sessions list
                try {
                    const updatedJson = await validateAdminKey(adminKey);
                    const sessions = Array.isArray(updatedJson.sessions) ? updatedJson.sessions : [];
                    loadAdminSessions(adminKey, sessions);
                } catch (e) {
                    console.error('Failed to refresh sessions:', e);
                }
            } catch {
                hideLoading();
                toast('Failed to create session', { type: 'error' });
            }
        });
        setTimeout(() => { try { input.focus(); } catch {} }, 0);
    }

    // Dialog: Admin Authentication
    function openAdminDialog(opts) {
        opts = opts || {};
        const existing = document.querySelector('[data-admin-dialog="true"]');
        if (existing) {
            const input = existing.querySelector('#adminKeyInput');
            setTimeout(() => {
                try { if (input) input.focus(); } catch {}
            }, 0);
            return;
        }
        const preset = typeof opts.preset === 'string' ? opts.preset : '';
        const error = typeof opts.error === 'string' ? opts.error : '';
        const overlay = document.createElement('div');
        overlay.setAttribute('data-admin-dialog', 'true');
        overlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50';
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-lg p-4 w-full max-w-sm shadow-lg';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'adminTitle');
        dialog.tabIndex = -1;
        const safePreset = preset.replace(/"/g, '&quot;');
        dialog.innerHTML = `
            <h2 id="adminTitle" class="text-sm font-semibold mb-2">Admin mode</h2>
            <div class="text-sm mb-3">Enter the admin key to enable server-backed sessions.</div>
            <label class="block text-xs text-gray-700 mb-1" for="adminKeyInput">Admin key</label>
            <input id="adminKeyInput" type="password" class="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" value="${safePreset}">
            ${error ? '<div class="text-xs text-red-600 mb-2">' + error + '</div>' : '<div class="mb-2"></div>'}
            <div class="flex justify-end gap-2">
                <button id="adminCancel" class="px-3 py-1 border border-gray-300 rounded">Cancel</button>
                <button id="adminConfirm" class="btn-primary text-white px-3 py-1 rounded">Verify</button>
            </div>
        `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const prevOverflow = document.body.style.overflow;
        const prevPaddingRight = document.body.style.paddingRight;
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollBarWidth > 0) document.body.style.paddingRight = String(scrollBarWidth) + 'px';
        document.body.style.overflow = 'hidden';

        const input = dialog.querySelector('#adminKeyInput');
        const cancelBtn = dialog.querySelector('#adminCancel');
        const confirmBtn = dialog.querySelector('#adminConfirm');

        function close(options) {
            options = options || {};
            const restore = options.restore === false ? false : true;
            overlay.remove();
            if (restore) {
                document.body.style.overflow = prevOverflow;
                document.body.style.paddingRight = prevPaddingRight;
            }
        }

        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
            if (e.key === 'Enter') { e.preventDefault(); confirmBtn.click(); }
        });
        cancelBtn.addEventListener('click', () => {
            close();
        });
        confirmBtn.addEventListener('click', async () => {
            const key = (input.value || '').trim();
            if (!key) return;
            showLoading('Verifying admin key...');
            try {
                const json = await validateAdminKey(key);
                try { sessionStorage.setItem('mfq_admin_key', key); } catch {}
                hideLoading();
                close();
                const sessions = Array.isArray(json.sessions) ? json.sessions : [];
                const names = sessions.map(s => s.name).filter(Boolean);
                toast(names.length ? 'Admin OK • ' + names.length + ' sessions' : 'Admin OK', { type: 'success' });
                loadAdminSessions(key, sessions);
            } catch (e) {
                hideLoading();
                close({ restore: false });
                openAdminDialog({ preset: input.value || '', error: 'Invalid admin key. Try again.' });
            }
        });

        setTimeout(() => { try { input.focus(); } catch {} }, 0);
    }

    // Admin session management helpers
    function loadAdminSessions(adminKey, sessions) {
        // First, show the session gate UI
        showSessionGate();

        console.log('[loadAdminSessions] Received sessions:', sessions.length, sessions);

        // Load sessions into the session picker's "Existing" tab
        const pickerHost = (typeof sessionPickerHost !== 'undefined' && sessionPickerHost)
            ? sessionPickerHost
            : document.getElementById('session-section');
        if (pickerHost && window.SessionPicker) {
            window.SessionPicker.setAdminSessions(pickerHost, sessions, adminKey);
        }

        // If the picker host isn't ready yet (e.g., overlay still mounting), retry once the stack clears
        if (!pickerHost && typeof window !== 'undefined') {
            setTimeout(() => {
                const retryHost = sessionPickerHost || document.getElementById('session-section');
                if (retryHost && window.SessionPicker) {
                    window.SessionPicker.setAdminSessions(retryHost, sessions, adminKey);
                }
            }, 0);
        }

        // BUG FIX #2: Show the admin sessions button in the header
        const adminSessionsBtn = document.getElementById('adminSessionsBtn');
        if (adminSessionsBtn) {
            // Use setProperty with !important to override Tailwind's !important
            adminSessionsBtn.style.setProperty('display', 'inline-block', 'important');
            adminSessionsBtn.classList.remove('hidden');

            // Remove existing event listener if any
            const newBtn = adminSessionsBtn.cloneNode(true);
            adminSessionsBtn.parentNode.replaceChild(newBtn, adminSessionsBtn);

            // Ensure visibility on the new button too
            newBtn.style.setProperty('display', 'inline-block', 'important');
            newBtn.classList.remove('hidden');

            // Add click handler to reopen session picker
            newBtn.addEventListener('click', () => {
                showAdminSessionPicker(adminKey);
            });
        }
    }

    async function showAdminSessionPicker(adminKey) {
        // Refresh sessions list from server
        showLoading('Loading sessions...');
        try {
            const json = await validateAdminKey(adminKey);
            const sessions = Array.isArray(json.sessions) ? json.sessions : [];
            hideLoading();

            // Show the session gate with updated sessions
            if (typeof window.lockApp === 'function') {
                window.lockApp();
            }
            loadAdminSessions(adminKey, sessions);
        } catch (e) {
            hideLoading();
            toast('Failed to load sessions', { type: 'error' });
            console.error('Failed to refresh sessions:', e);
        }
    }

    // Admin UI initialization
    function initAdminUI() {
        try {
            const u = new URL(window.location.href);
            if (u.searchParams.get('admin') !== '1') return;
        } catch { return; }

        const banner = document.getElementById('adminBanner');
        if (banner) banner.classList.remove('hidden');

        let existing = '';
        try { existing = sessionStorage.getItem('mfq_admin_key') || ''; } catch {}
        if (!existing) {
            openAdminDialog();
            return;
        }
        showLoading('Verifying admin access...');
        validateAdminKey(existing).then((json) => {
            // valid, load sessions into picker
            hideLoading();
            const sessions = Array.isArray(json.sessions) ? json.sessions : [];
            toast(sessions.length ? `Admin OK • ${sessions.length} sessions` : 'Admin OK', { type: 'success' });
            loadAdminSessions(existing, sessions);
        }).catch(() => {
            hideLoading();
            openAdminDialog({ preset: existing, error: 'Saved key is no longer valid.' });
        });
    }

    // Export as global module
    const dialogs = {
        showCreateSessionDialog,
        showSessionGate,
        showAdminSessionsPanel,
        openShareLinksDialog,
        openCreateServerSessionDialog,
        openAdminDialog,
        unlockApp,
        loadAdminSessions,
        showAdminSessionPicker,
        initAdminUI,
        // Export helper for backwards compatibility
        escapeHtml
    };

    // Make available globally
    if (global) {
        global.Dialogs = dialogs;
        // Also expose for AdminUI backwards compatibility
        global.AdminUI = { init: initAdminUI };
        // Expose individual functions for backwards compatibility
        global.openShareLinksDialog = openShareLinksDialog;
    }

    // CommonJS export for tests
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = dialogs;
    }
})(typeof window !== 'undefined' ? window : globalThis);
