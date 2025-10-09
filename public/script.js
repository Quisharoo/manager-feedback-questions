        const themeColors = {
            "Vision + Priorities": "bg-indigo-100 text-indigo-800",
            "Work Style": "bg-blue-100 text-blue-800",
            "Support + Load-Balancing": "bg-green-100 text-green-800",
            "Coaching + Development": "bg-yellow-100 text-yellow-800",
            "Work Conditions": "bg-purple-100 text-purple-800",
            "Team + Dynamics": "bg-pink-100 text-pink-800",
            "Efficiency + Frustrations": "bg-red-100 text-red-800"
        };

        const questions = [
            { theme: "Vision + Priorities", text: "Am I giving you enough information to do your job well?" },
            { theme: "Vision + Priorities", text: "Would you like more or less direction from me right now?" },
            { theme: "Vision + Priorities", text: "Do you feel clear on where we're headed and why?" },
            { theme: "Vision + Priorities", text: "Are there any priorities I can clarify for you?" },
            { theme: "Work Style", text: "What part of my communication style makes your job harder than it should?" },
            { theme: "Work Style", text: "Is there a decision I've made recently that you disagreed with—or didn't understand?" },
            { theme: "Work Style", text: "What's something I could stop doing that would make things easier for you?" },
            { theme: "Support + Load-Balancing", text: "Do you feel like you're spread too thin right now?" },
            { theme: "Support + Load-Balancing", text: "Is there anything I could take off your plate this week?" },
            { theme: "Support + Load-Balancing", text: "Have I been mindful enough of timelines and bandwidth?" },
            { theme: "Support + Load-Balancing", text: "Would it help to reprioritize anything?" },
            { theme: "Coaching + Development", text: "What aspect of your role would you like more coaching on?" },
            { theme: "Coaching + Development", text: "Are there any skills you've been wanting to build but haven't had time?" },
            { theme: "Coaching + Development", text: "Is there a challenge you're facing that we could unpack together?" },
            { theme: "Coaching + Development", text: "What's a decision you're stuck on that we could talk through?" },
            { theme: "Work Conditions", text: "Am I interrupting you too often with meetings or requests?" },
            { theme: "Work Conditions", text: "Do you feel like you have enough focus time to get real work done?" },
            { theme: "Work Conditions", text: "Is there any tool, resource, or system that's making your job harder than it needs to be?" },
            { theme: "Team + Dynamics", text: "Are there any relationships or team dynamics that have felt tricky lately?" },
            { theme: "Team + Dynamics", text: "Is there a conversation we haven't had yet that we probably should?" },
            { theme: "Team + Dynamics", text: "What's something you wish people talked about more openly on the team?" },
            { theme: "Efficiency + Frustrations", text: "What's one thing that's been frustrating you the past few weeks?" },
            { theme: "Efficiency + Frustrations", text: "What are your biggest time-wasters right now?" },
            { theme: "Efficiency + Frustrations", text: "What's something you wish we did more efficiently as a team?" }
        ];

        const questionContainer = document.getElementById('question-container');
        const sessionSection = document.getElementById('session-section');
        const askedContainer = document.getElementById('asked-container');
        const exhaustedBanner = document.getElementById('exhaustedBanner');
        const exhaustResetBtn = document.getElementById('exhaustResetBtn');
        const exhaustNewBtn = document.getElementById('exhaustNewBtn');
        const nextBtn = document.getElementById('nextBtn');
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        let resultsBtn = null;
        const sessionBadge = document.getElementById('sessionBadge');
        const historyChip = document.getElementById('historyChip');
        const questionCard = document.querySelector('.question-card');
        let sessionPickerHost = null;

        function getSessionSelect() {
            return document.getElementById('sessionSelect');
        }

        const idMap = window.SelectionUtils.buildIdMap(questions);
        let activeSession = null; // { name, askedIds, timestamps }
        let currentQuestionId = null;
        let isPreview = false;
        let isAdvancing = false;
        let resetUndoTimer = null;

        // --- Server capability mode detection ---
        function getUrlParams() {
            try {
                const u = new URL(window.location.href);
                return { id: u.searchParams.get('id') || '', key: u.searchParams.get('key') || '', cap: u.searchParams.get('cap') || '' };
            } catch { return { id: '', key: '', cap: '' }; }
        }
        function persistKey(id, key) {
            try { if (id && key) sessionStorage.setItem('mfq_key_' + id, key); } catch {}
        }
        function getStoredKey(id) {
            try { return id ? (sessionStorage.getItem('mfq_key_' + id) || '') : ''; } catch { return ''; }
        }
        const params = getUrlParams();
        const serverSessionId = params.id || '';
        const serverSessionKey = (params.key || getStoredKey(serverSessionId) || '');
        const isServerMode = !!(serverSessionId && serverSessionKey);
        if (isServerMode && params.key) persistKey(serverSessionId, serverSessionKey);

        function ensureResultsButton() {
            if (!isServerMode) return;
            if (resultsBtn) return;
            const parent = nextBtn && nextBtn.parentElement;
            if (!parent) return;
            resultsBtn = document.createElement('a');
            resultsBtn.id = 'resultsBtn';
            resultsBtn.className = 'btn-primary text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg';
            resultsBtn.textContent = 'Results';
            const capParam = params.cap === '1' ? '&cap=1' : '';
            resultsBtn.href = `/results.html?id=${encodeURIComponent(serverSessionId)}&key=${encodeURIComponent(serverSessionKey)}${capParam}`;
            parent.appendChild(resultsBtn);
        }

        async function apiGetSession(id, key) {
            const res = await fetch(`/api/sessions/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`);
            if (!res.ok) throw new Error('Failed to load session');
            return res.json();
        }
        async function apiGetCapSession(id, key) {
            const res = await fetch(`/api/capsessions/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`);
            if (!res.ok) throw new Error('Failed to load session');
            return res.json();
        }
        async function apiPatch(id, key, body) {
            const res = await fetch(`/api/sessions/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {})
            });
            if (!res.ok) throw new Error('Failed to update session');
            return res.json();
        }
        async function apiPatchCap(id, key, body) {
            const res = await fetch(`/api/capsessions/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {})
            });
            if (!res.ok) throw new Error('Failed to update session');
            return res.json();
        }

        function mapAskedToIds(askedArray) {
            const texts = Array.isArray(askedArray) ? askedArray.map(q => (q && q.text) || '') : [];
            const textToId = new Map();
            idMap.order.forEach(id => {
                const q = idMap.byId.get(id);
                if (q && typeof q.text === 'string') textToId.set(q.text, id);
            });
            return texts.map(t => textToId.get(t)).filter(Boolean);
        }

        async function serverLoadAndOpen() {
            try {
                const data = await apiGetCapSession(serverSessionId, serverSessionKey);
                const askedIds = mapAskedToIds(data.asked || []);
                // Synthesize timestamps for display (approximate ordering)
                const base = Date.now();
                const timestamps = askedIds.map((_, i) => base - (askedIds.length - 1 - i) * 1000);
                // Map server answers keyed by question text to local IDs
                const answers = (data && data.answers && typeof data.answers === 'object') ? data.answers : {};
                const idToAnswer = {};
                for (const [text, value] of Object.entries(answers)) {
                    const entry = Array.from(idMap.byId.values()).find(q => q && q.text === text);
                    if (entry && typeof value === 'string' && value.trim() !== '') idToAnswer[String(entry.id)] = value;
                }
                activeSession = { name: data.name || 'session', askedIds, timestamps, answers: idToAnswer };
                window.__activeSessionName = activeSession.name;
                
                // Check if there's a persisted current question
                let currentId = null;
                if (data.currentQuestion && data.currentQuestion.text) {
                    // Find the ID for the current question text
                    const currentQuestion = Array.from(idMap.byId.values()).find(q => q && q.text === data.currentQuestion.text);
                    if (currentQuestion) {
                        currentId = currentQuestion.id;
                    }
                }
                
                if (currentId) {
                    // Show the persisted current question
                    isPreview = false;
                    renderQuestionById(currentId, { persist: false });
                } else {
                    // Choose next question if no current question is persisted
                    const askedSet = new Set(activeSession.askedIds);
                    const nextId = window.SelectionUtils.nextQuestionId(idMap.order, askedSet);
                    if (nextId) {
                        isPreview = false;
                        renderQuestionById(nextId, { persist: false });
                        // Persist the selected current question on initial load in server mode
                        try {
                            const q = idMap.byId.get(nextId);
                            if (isServerMode && q) {
                                await apiPatchCap(serverSessionId, serverSessionKey, { action: 'setCurrentQuestion', question: { text: q && q.text } });
                            }
                        } catch {}
                    } else {
                        renderQuestionById(null, { persist: false });
                    }
                }
                updateSessionInfo();
                if (askedContainer && window.AskedList) {
                    const answeredIds = Object.keys(idToAnswer);
                    window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps, answeredIds });
                }
                unlockApp();
            } catch (e) {
                console.error('Failed to load server session');
            }
        }

        function renderQuestionById(id, { persist } = { persist: false }) {
            const question = id ? idMap.byId.get(id) : null;
            if (!id || !question) {
                questionContainer.innerHTML = `
                <div class="p-8 text-center">
                    <div class="text-indigo-400 text-6xl mb-4">
                        <i class="fas fa-question-circle"></i>
                    </div>
                    <p class="text-gray-500 italic">Start a session to get a question</p>
                </div>`;
                currentQuestionId = null;
                isPreview = false;
                if (historyChip) historyChip.classList.add('hidden');
                return;
            }

            const themeClass = themeColors[question.theme] || 'bg-gray-100 text-gray-800';
            questionContainer.innerHTML = `
                <div class="${themeClass.split(' ')[1]} text-4xl mb-4">
                    <i class="fas fa-quote-left"></i>
                </div>
                <p class="text-sm uppercase tracking-wider ${themeClass} px-2 py-1 rounded-full inline-block mb-2">${question.theme}</p>
                <p class="text-xl md:text-2xl text-gray-800 font-medium mb-3">${question.text}</p>
                <div class="mt-4 text-left">
                    <label for="answerText" class="block text-sm font-medium text-gray-700 mb-1">Your answer</label>
                    <textarea id="answerText" class="w-full border border-gray-300 rounded-lg px-3 py-2 h-28 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Type your notes here…"></textarea>
                </div>
                <div class="${themeClass.split(' ')[1]} text-4xl mt-4">
                    <i class="fas fa-quote-right"></i>
                </div>
            `;
            if (questionCard) questionCard.classList.add('transform', 'scale-105');
            setTimeout(() => {
                if (questionCard) questionCard.classList.remove('transform', 'scale-105');
            }, 300);
            currentQuestionId = id;
            if (persist && activeSession && !isPreview && window.SessionStore && typeof window.SessionStore.setCurrent === 'function') {
                window.SessionStore.setCurrent(activeSession.name, id);
                activeSession = window.SessionStore.open(activeSession.name);
            }

            // Wire up answer editor
            try {
                const textarea = document.getElementById('answerText');
                const initial = (function() {
                    // In server mode, prefer server-loaded answers map
                    if (isServerMode && activeSession && activeSession.answers && typeof activeSession.answers === 'object') {
                        const v = activeSession.answers[String(id)];
                        return typeof v === 'string' ? v : '';
                    }
                    // Local mode falls back to SessionStore
                    return (activeSession && window.SessionStore && typeof window.SessionStore.getAnswer === 'function') ? window.SessionStore.getAnswer(activeSession.name, id) : '';
                })();
                textarea.value = initial;
                textarea.addEventListener('blur', async () => {
                    if (!activeSession) return;
                    const val = textarea.value || '';
                    if (isServerMode) {
                        try {
                            const q = idMap.byId.get(id);
                            await apiPatchCap(serverSessionId, serverSessionKey, { action: 'setAnswer', question: { text: q && q.text }, value: val });
                            if (!activeSession.answers || typeof activeSession.answers !== 'object') activeSession.answers = {};
                            activeSession.answers[String(id)] = val;
                            if (askedContainer && window.AskedList) {
                                const answeredIds = Object.entries(activeSession.answers || {}).filter(([,v]) => typeof v === 'string' && v.trim() !== '').map(([k]) => String(k));
                                window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps, answeredIds });
                            }
                        } catch {}
                    } else if (window.SessionStore && typeof window.SessionStore.setAnswer === 'function') {
                        window.SessionStore.setAnswer(activeSession.name, id, val);
                        activeSession = window.SessionStore.open(activeSession.name);
                        if (askedContainer && window.AskedList) {
                            const answeredIds = Object.entries(activeSession.answers || {}).filter(([,v]) => typeof v === 'string' && v.trim() !== '').map(([k]) => String(k));
                            window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps, answeredIds });
                        }
                    }
                });
            } catch {}
        }

        function updateSessionInfo() {
            if (!activeSession) {
                if (sessionBadge) sessionBadge.textContent = '';
                undoBtn.disabled = true;
                resetBtn.disabled = true;
                return;
            }
            const askedCount = activeSession.askedIds.length;
            const total = idMap.order.length;
            if (sessionBadge) sessionBadge.textContent = `Session: ${activeSession.name} • ${askedCount} of ${total} asked`;
            undoBtn.disabled = askedCount === 0;
            resetBtn.disabled = false;
        }

        function onOpenSession(name) {
            if (!name) return;
            if (isServerMode) {
                // In server mode, ignore local SessionStore for opening
                activeSession = activeSession && activeSession.name ? activeSession : { name, askedIds: [], timestamps: [] };
                window.__activeSessionName = name;
            } else {
                activeSession = window.SessionStore.open(name);
            }
            window.__activeSessionName = activeSession.name;
            if (activeSession.currentId) {
                renderQuestionById(activeSession.currentId, { persist: false });
                isPreview = false;
            } else {
                // Choose first question and immediately set it as current (no preview)
                const askedSet = new Set(activeSession.askedIds);
                const nextId = window.SelectionUtils.nextQuestionId(idMap.order, askedSet);
                if (nextId) {
                    isPreview = false;
                    renderQuestionById(nextId, { persist: !isServerMode });
                    if (historyChip) historyChip.classList.add('hidden');
                    
                    // Persist the current question in server mode
                    if (isServerMode) {
                        const q = idMap.byId.get(nextId);
                        try {
                            apiPatchCap(serverSessionId, serverSessionKey, { action: 'setCurrentQuestion', question: { text: q && q.text } });
                        } catch {}
                    }
                } else {
                    renderQuestionById(null, { persist: false });
                    isPreview = false;
                }
            }
            updateSessionInfo();
            if (askedContainer && window.AskedList) {
                const answeredIds = activeSession.answers ? Object.entries(activeSession.answers || {}).filter(([,v]) => typeof v === 'string' && v.trim() !== '').map(([k]) => String(k)) : [];
                window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps, answeredIds });
            }
            if (exhaustedBanner) exhaustedBanner.classList.add('invisible');
            if (nextBtn && typeof nextBtn.focus === 'function') { try { nextBtn.focus(); } catch {} }
            // Unlock UI if gated by session selection modal
            unlockApp();
        }

        function onCreateSession(name) {
            const trimmed = (name || '').trim();
            if (!trimmed) return;
            if (!window.SessionStore.exists(trimmed)) {
                try { window.SessionStore.create(trimmed); } catch {}
            }
            if (sessionPickerHost && window.SessionPicker) {
                window.SessionPicker.updateSessions(sessionPickerHost, window.SessionStore.getAll());
            }
            onOpenSession(trimmed);
        }

        if (!nextBtn._boundClick) nextBtn.addEventListener('click', async () => {
            if (isAdvancing) return;
            if (!activeSession) {
                const selEl = getSessionSelect();
                const sel = selEl && selEl.value;
                if (sel) {
                    activeSession = isServerMode ? { name: sel, askedIds: [], timestamps: [] } : window.SessionStore.open(sel);
                    updateSessionInfo();
                } else {
                    return;
                }
            }
            isAdvancing = true;
            // Save current answer implicitly
            try {
                const textarea = document.getElementById('answerText');
                if (textarea && currentQuestionId && activeSession) {
                    const val = textarea.value || '';
                    if (isServerMode) {
                        const q = idMap.byId.get(currentQuestionId);
                        await apiPatchCap(serverSessionId, serverSessionKey, { action: 'setAnswer', question: { text: q && q.text }, value: val });
                        if (!activeSession.answers || typeof activeSession.answers !== 'object') activeSession.answers = {};
                        activeSession.answers[String(currentQuestionId)] = val;
                    } else if (window.SessionStore && typeof window.SessionStore.setAnswer === 'function') {
                        window.SessionStore.setAnswer(activeSession.name, currentQuestionId, val);
                    }
                }
            } catch {}
            // Record the currently shown question as asked, whether preview or not.
            if (currentQuestionId) {
                if (isServerMode) {
                    const q = idMap.byId.get(currentQuestionId);
                    try {
                        await apiPatchCap(serverSessionId, serverSessionKey, { action: 'markAsked', question: { text: q && q.text } });
                        const now = Date.now();
                        activeSession.askedIds = (activeSession.askedIds || []).concat([currentQuestionId]);
                        activeSession.timestamps = (activeSession.timestamps || []).concat([now]);
                    } catch {}
                } else {
                    window.SessionStore.addAsked(activeSession.name, currentQuestionId);
                    activeSession = window.SessionStore.open(activeSession.name);
                }
            }
            const askedSet = new Set(activeSession.askedIds);
            const nextId = window.SelectionUtils.nextQuestionId(idMap.order, askedSet);
            if (!nextId) {
                if (exhaustedBanner) exhaustedBanner.classList.remove('invisible');
                updateSessionInfo();
                isAdvancing = false;
                return;
            }
            renderQuestionById(nextId, { persist: !isServerMode });
            isPreview = false;
            if (historyChip) historyChip.classList.add('hidden');
            
            // Persist the current question in server mode
            if (isServerMode && nextId) {
                const q = idMap.byId.get(nextId);
                try {
                    await apiPatchCap(serverSessionId, serverSessionKey, { action: 'setCurrentQuestion', question: { text: q && q.text } });
                } catch {}
            }
            
            updateSessionInfo();
            if (askedContainer && window.AskedList) {
                const answeredIds = activeSession.answers ? Object.entries(activeSession.answers || {}).filter(([,v]) => typeof v === 'string' && v.trim() !== '').map(([k]) => String(k)) : [];
                window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps, answeredIds });
            }
            isAdvancing = false;
        }); nextBtn._boundClick = true;

        if (!undoBtn._boundClick) undoBtn.addEventListener('click', async () => {
            if (!activeSession) {
                const selEl = getSessionSelect();
                const sel = selEl && selEl.value;
                if (sel) activeSession = isServerMode ? { name: sel, askedIds: [], timestamps: [] } : window.SessionStore.open(sel); else return;
            }
            let last = null;
            if (isServerMode) {
                try {
                    await apiPatchCap(serverSessionId, serverSessionKey, { action: 'undoAsked' });
                    last = activeSession.askedIds.pop();
                    if (Array.isArray(activeSession.timestamps)) activeSession.timestamps.pop();
                } catch {}
            } else {
                last = window.SessionStore.removeLastAsked(activeSession.name);
                activeSession = window.SessionStore.open(activeSession.name);
            }
            if (last) {
                renderQuestionById(last, { persist: true });
            }
            isPreview = false;
            if (historyChip) historyChip.classList.add('hidden');
            updateSessionInfo();
            if (askedContainer && window.AskedList) {
                const answeredIds = (!isServerMode && activeSession.answers) ? Object.entries(activeSession.answers || {}).filter(([,v]) => typeof v === 'string' && v.trim() !== '').map(([k]) => String(k)) : [];
                window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps, answeredIds });
            }
            if (exhaustedBanner) exhaustedBanner.classList.add('invisible');
        }); undoBtn._boundClick = true;

        function performReset() {
            if (!activeSession) return;
            if (isServerMode) {
                apiPatchCap(serverSessionId, serverSessionKey, { action: 'reset' }).catch(() => {});
                activeSession.askedIds = [];
                activeSession.timestamps = [];
            } else {
                window.SessionStore.reset(activeSession.name);
                activeSession = window.SessionStore.open(activeSession.name);
            }
            renderQuestionById(null);
            updateSessionInfo();
            if (askedContainer && window.AskedList) window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps });
            if (exhaustedBanner) exhaustedBanner.classList.add('invisible');
        }

        function confirmReset() {
            if (!activeSession) return;
            const name = activeSession.name;
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50';
            const dialog = document.createElement('div');
            dialog.className = 'bg-white rounded-lg p-4 w-full max-w-sm shadow-lg';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'resetTitle');
            dialog.tabIndex = -1;
            dialog.innerHTML = `
                <h2 id="resetTitle" class="text-sm font-semibold mb-2">Reset session</h2>
                <div class="text-sm mb-3">Reset asked questions and any saved answers for <span class="font-semibold">${name}</span>?</div>
                <div class="flex justify-end gap-2">
                    <button id="resetCancel" class="px-3 py-1 border border-gray-300 rounded">Cancel</button>
                    <button id="resetConfirm" class="btn-primary text-white px-3 py-1 rounded">Reset</button>
                </div>`;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            const prevOverflow = document.body.style.overflow;
            const prevPaddingRight = document.body.style.paddingRight;
            const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
            if (scrollBarWidth > 0) {
                document.body.style.paddingRight = String(scrollBarWidth) + 'px';
            }
            document.body.style.overflow = 'hidden';

            const cancelBtn = dialog.querySelector('#resetCancel');
            const confirmBtn = dialog.querySelector('#resetConfirm');
            const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
            function getFocusable() {
                return Array.from(dialog.querySelectorAll(focusableSelectors)).filter(el => !el.disabled && el.offsetParent !== null);
            }
            const prevFocus = document.activeElement;
            function closeDialog() {
                overlay.remove();
                document.body.style.overflow = prevOverflow;
                document.body.style.paddingRight = prevPaddingRight;
                if (resetBtn && typeof resetBtn.focus === 'function') { try { resetBtn.focus(); } catch {} }
            }
            overlay.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') { e.preventDefault(); closeDialog(); }
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
            });
            cancelBtn.addEventListener('click', () => closeDialog());
            confirmBtn.addEventListener('click', () => {
                closeDialog();
                performReset();
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded shadow flex items-center gap-3';
                toast.innerHTML = `<span>Session reset</span><button class="px-2 py-0.5 bg-white text-gray-900 rounded" id="undoResetBtn">Undo</button>`;
                document.body.appendChild(toast);
                clearTimeout(resetUndoTimer);
                resetUndoTimer = setTimeout(() => { toast.remove(); }, 5000);
                toast.querySelector('#undoResetBtn').addEventListener('click', () => {
                    toast.remove();
                });
            });
            setTimeout(() => { try { cancelBtn.focus(); } catch {} }, 0);
        }

        if (!resetBtn._boundClick) resetBtn.addEventListener('click', () => {
            if (!activeSession) {
                const selEl = getSessionSelect();
                const sel = selEl && selEl.value;
                if (sel) activeSession = window.SessionStore.open(sel); else return;
            }
            confirmReset();
        }); resetBtn._boundClick = true;

        if (exhaustResetBtn) exhaustResetBtn.addEventListener('click', () => resetBtn.click());
        if (exhaustNewBtn) exhaustNewBtn.addEventListener('click', () => {
            // Show gate again to start a new session
            lockApp();
            const tabNew = document.querySelector('#sessionGateOverlay #tab-new');
            if (tabNew) tabNew.click();
        });

        // --- Session gate helpers ---
        function renderSessionPickerInto(container) {
            if (container && window.SessionPicker) {
                sessionPickerHost = container;
                window.SessionPicker.render(container, {
                    sessions: window.SessionStore.getAll(),
                    onOpen: onOpenSession,
                    onCreate: onCreateSession,
                });
            }
        }

        function lockApp() {
            try {
                if (askedContainer) askedContainer.classList.add('hidden');
                if (exhaustedBanner) exhaustedBanner.classList.add('invisible');
                if (nextBtn) nextBtn.classList.add('hidden');
                if (undoBtn) undoBtn.classList.add('hidden');
                if (resetBtn) resetBtn.classList.add('hidden');
                if (resultsBtn) resultsBtn.classList.add('hidden');
                const adminFab = document.getElementById('adminCreateBtn');
                if (adminFab) adminFab.classList.add('hidden');
                if (questionCard) questionCard.classList.add('hidden');
            } catch {}

            if (document.getElementById('sessionGateOverlay')) return;
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

            // Dynamic helper text
            try {
                const gateHelper = dialog.querySelector('#gateHelper');
                const sessions = window.SessionStore.getAll();
                if (Array.isArray(sessions) && sessions.length === 0) {
                    gateHelper.textContent = 'Create a new session to begin.';
                } else {
                    gateHelper.textContent = 'Pick an existing session or create a new one to begin.';
                }
            } catch {}

            const host = dialog.querySelector('#sessionGateHost');
            renderSessionPickerInto(host);
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

        function unlockApp() {
            try {
                if (askedContainer) askedContainer.classList.remove('hidden');
                if (nextBtn) nextBtn.classList.remove('hidden');
                if (undoBtn) undoBtn.classList.remove('hidden');
                if (resetBtn) resetBtn.classList.remove('hidden');
                ensureResultsButton();
                if (resultsBtn) resultsBtn.classList.remove('hidden');
                try {
                    const key = sessionStorage.getItem('mfq_admin_key') || '';
                    if (key) ensureAdminControls(key);
                } catch {}
                if (questionCard) questionCard.classList.remove('hidden');
            } catch {}
            const overlay = document.getElementById('sessionGateOverlay');
            if (overlay) {
                if (typeof overlay._restore === 'function') { try { overlay._restore(); } catch {} }
                overlay.remove();
            }
        }
        
        // init: gate the app on load
        if (!isServerMode) {
            lockApp();
        } else {
            // In server mode, load the remote session and unlock UI
            serverLoadAndOpen();
        }
        if (askedContainer && window.AskedList) {
            const questionsById = new Map();
            idMap.order.forEach(id => { const q = idMap.byId.get(id); if (q) questionsById.set(id, q); });
            window.AskedList.render(askedContainer, { askedIds: [], timestamps: [], questionsById, answeredIds: [], onSelect: (id) => {
                renderQuestionById(id, { persist: false });
                isPreview = true;
                if (historyChip) {
                    historyChip.classList.remove('hidden');
                    historyChip.innerHTML = '<button type="button" id="returnLiveBtn" class="underline">Return to live</button>';
                    const btn = document.getElementById('returnLiveBtn');
                    if (btn) btn.addEventListener('click', () => {
                        const cur = activeSession && activeSession.currentId ? activeSession.currentId : null;
                        renderQuestionById(cur, { persist: false });
                        isPreview = false;
                        historyChip.classList.add('hidden');
                    });
                }
                if (exhaustedBanner) exhaustedBanner.classList.add('invisible');
            }});
        }
        renderQuestionById(null, { persist: false });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const tag = (e.target && e.target.tagName) || '';
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
            if (isInput) return;
            // Ignore when modifier keys are pressed (e.g., Cmd+R/Ctrl+R reload)
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === 'n' || e.key === 'N') { e.preventDefault(); nextBtn.click(); }
            if (e.key === 'u' || e.key === 'U') { e.preventDefault(); if (!undoBtn.disabled) undoBtn.click(); }
            if (e.key === 'r' || e.key === 'R') { e.preventDefault(); if (!resetBtn.disabled) resetBtn.click(); }
        });

        // Relock if current session is deleted via SessionPicker
        window.addEventListener('session-deleted', (ev) => {
            try {
                const deleted = ev && ev.detail && ev.detail.name;
                if (deleted && typeof window.__activeSessionName === 'string' && deleted === window.__activeSessionName) {
                    activeSession = null;
                    window.__activeSessionName = undefined;
                    renderQuestionById(null, { persist: false });
                    updateSessionInfo();
                    lockApp();
                }
            } catch {}
        });

 
// --- Admin setup modal + auto-verify ---
(function () {
    function toast(msg) {
        const t = document.createElement('div');
        t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded shadow';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.remove(); }, 2500);
    }

    async function validateAdminKey(key) {
        const res = await fetch('/api/admin/sessions', { headers: { Authorization: 'Key ' + key } });
        if (!res.ok) throw new Error('Invalid');
        return res.json().catch(() => ({}));
    }

    function openShareLinksDialog(links) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50';
        const dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-lg p-4 w-full max-w-lg shadow-lg';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'shareTitle');
        dialog.tabIndex = -1;
        const editLink = (links && links.edit) || '';
        const viewLink = (links && links.view) || '';
        dialog.innerHTML = `
            <h2 id="shareTitle" class="text-sm font-semibold mb-2">Share links</h2>
            <div class="text-xs text-gray-600 mb-3">Copy and share the appropriate link.</div>
            <label class="block text-xs text-gray-700 mb-1">Edit link (full access)</label>
            <div class="flex gap-2 mb-2">
                <input id="shareEditInput" class="flex-1 w-full border border-gray-300 rounded px-2 py-1 text-xs" value="${editLink.replace(/"/g, '&quot;')}">
                <button id="copyEdit" class="px-2 py-1 text-xs btn-primary text-white rounded">Copy</button>
                <a id="openEdit" class="px-2 py-1 text-xs border border-gray-300 rounded" href="${editLink}" target="_blank" rel="noopener">Open</a>
            </div>
            <label class="block text-xs text-gray-700 mb-1 mt-3">View-only link</label>
            <div class="flex gap-2 mb-4">
                <input id="shareViewInput" class="flex-1 w-full border border-gray-300 rounded px-2 py-1 text-xs" value="${viewLink.replace(/"/g, '&quot;')}">
                <button id="copyView" class="px-2 py-1 text-xs btn-primary text-white rounded">Copy</button>
                <a id="openView" class="px-2 py-1 text-xs border border-gray-300 rounded" href="${viewLink}" target="_blank" rel="noopener">Open</a>
            </div>
            <div class="flex justify-end gap-2">
                <button id="shareClose" class="px-3 py-1 border border-gray-300 rounded">Close</button>
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
        function bindCopy(btnId, inputId) {
            const btn = dialog.querySelector(btnId);
            const input = dialog.querySelector(inputId);
            if (!btn || !input) return;
            btn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(input.value || '');
                    toast('Copied');
                } catch {
                    try { input.select(); document.execCommand('copy'); toast('Copied'); } catch {}
                }
            });
        }
        bindCopy('#copyEdit', '#shareEditInput');
        bindCopy('#copyView', '#shareViewInput');
        const closeBtn = dialog.querySelector('#shareClose');
        closeBtn.addEventListener('click', () => close());
        setTimeout(() => { try { dialog.focus(); } catch {} }, 0);
    }

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
            try {
                const res = await fetch('/api/admin/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Key ' + adminKey },
                    body: JSON.stringify({ name })
                });
                if (!res.ok) throw new Error('Failed');
                const json = await res.json();
                close();
                if (json && json.links) openShareLinksDialog(json.links);
            } catch {
                toast('Failed to create');
            }
        });
        setTimeout(() => { try { input.focus(); } catch {} }, 0);
    }

    function ensureAdminControls(adminKey) {
        if (!adminKey) return;
        let floatBtn = document.getElementById('adminCreateBtn');
        if (!floatBtn) {
            floatBtn = document.createElement('button');
            floatBtn.id = 'adminCreateBtn';
            floatBtn.className = 'fixed bottom-6 right-6 btn-primary text-white px-4 py-2 rounded-full shadow-lg';
            floatBtn.textContent = 'Create server session';
            floatBtn.style.zIndex = '60';
            floatBtn.addEventListener('click', () => {
                if (!floatBtn._adminKey) return;
                openCreateServerSessionDialog(floatBtn._adminKey);
            });
            document.body.appendChild(floatBtn);
        }
        floatBtn._adminKey = adminKey;
        floatBtn.classList.remove('hidden');
    }

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
            if (e.key === 'Escape') { e.preventDefault(); close(); }
            if (e.key === 'Enter') { e.preventDefault(); confirmBtn.click(); }
        });
        cancelBtn.addEventListener('click', () => close());
        confirmBtn.addEventListener('click', async () => {
            const key = (input.value || '').trim();
            if (!key) return;
            try {
                const json = await validateAdminKey(key);
                try { sessionStorage.setItem('mfq_admin_key', key); } catch {}
                close();
                const names = Array.isArray(json.sessions) ? json.sessions.map(s => s.name).filter(Boolean) : [];
                toast(names.length ? 'Admin OK • ' + names.length + ' sessions' : 'Admin OK');
                ensureAdminControls(key);
            } catch (e) {
                close({ restore: false });
                openAdminDialog({ preset: input.value || '', error: 'Invalid admin key. Try again.' });
            }
        });

        setTimeout(() => { try { input.focus(); } catch {} }, 0);
    }

    function init() {
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
        validateAdminKey(existing).then(() => {
            // valid, show quick controls
            ensureAdminControls(existing);
        }).catch(() => {
            openAdminDialog({ preset: existing, error: 'Saved key is no longer valid.' });
        });
    }

    if (typeof window !== 'undefined') {
        window.AdminUI = { init: init };
    }
})();

// Auto-init in environments that don't execute inline HTML scripts (e.g., Jest jsdom)
(function(){
    try {
        const u = new URL(window.location.href);
        if (u.searchParams.get('admin') === '1' && window.AdminUI && typeof window.AdminUI.init === 'function') {
            window.AdminUI.init();
        }
    } catch {}
})();
