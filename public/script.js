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

        // Global toast notification system
        function toast(msg, options = {}) {
            const duration = options.duration || 2500;
            const type = options.type || 'default'; // 'default', 'success', 'error'
            const t = document.createElement('div');

            let bgClass = 'bg-gray-900';
            let icon = '';
            if (type === 'success') {
                bgClass = 'bg-green-600';
                icon = '<i class="fas fa-check-circle mr-2"></i>';
            } else if (type === 'error') {
                bgClass = 'bg-red-600';
                icon = '<i class="fas fa-exclamation-circle mr-2"></i>';
            }

            t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 ${bgClass} text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center z-50 animate-slide-up`;
            t.innerHTML = `${icon}<span>${msg}</span>`;
            t.setAttribute('role', 'status');
            t.setAttribute('aria-live', 'polite');
            document.body.appendChild(t);
            setTimeout(() => {
                t.style.opacity = '0';
                t.style.transform = 'translateX(-50%) translateY(10px)';
                t.style.transition = 'all 0.3s ease';
                setTimeout(() => t.remove(), 300);
            }, duration);
        }
        window.toast = toast; // Make available globally

        // Loading state management
        let loadingOverlay = null;
        function showLoading(message = 'Loading...') {
            if (loadingOverlay) return; // Prevent multiple overlays
            loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center">
                    <div class="loading-spinner-large mb-3"></div>
                    <div class="text-gray-700 text-sm">${message}</div>
                </div>
            `;
            document.body.appendChild(loadingOverlay);
        }
        function hideLoading() {
            if (loadingOverlay) {
                loadingOverlay.remove();
                loadingOverlay = null;
            }
        }
        window.showLoading = showLoading;
        window.hideLoading = hideLoading;

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

        function persistCurrentQuestion(id) {
            if (activeSession) {
                activeSession.currentId = id ? String(id) : null;
            }
            if (!isServerMode) return;
            const storageKey = `mfq_current_${serverSessionId}`;
            try {
                if (id) {
                    sessionStorage.setItem(storageKey, String(id));
                    localStorage.setItem(storageKey, String(id));
                } else {
                    sessionStorage.removeItem(storageKey);
                    localStorage.removeItem(storageKey);
                }
            } catch {}
        }

        function readPersistedCurrent() {
            if (!isServerMode) return null;
            const storageKey = `mfq_current_${serverSessionId}`;
            try {
                const stored = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
                return stored && stored.trim() ? stored : null;
            } catch {
                return null;
            }
        }

        function questionPayloadById(id) {
            if (!id) return null;
            const q = idMap.byId.get(id);
            if (!q) return null;
            const payload = { id: String(id), text: q.text };
            if (q.theme) payload.theme = q.theme;
            return payload;
        }

        function ensureResultsButton() {
            if (!isServerMode) return;
            if (resultsBtn) return;
            const parent = nextBtn && nextBtn.parentElement;
            if (!parent) return;
            resultsBtn = document.createElement('a');
            resultsBtn.id = 'resultsBtn';
            resultsBtn.className = 'btn-primary text-white font-bold py-4 px-8 rounded-full text-lg shadow-lg';
            resultsBtn.textContent = 'Results';
            resultsBtn.href = `/results.html?id=${encodeURIComponent(serverSessionId)}&key=${encodeURIComponent(serverSessionKey)}`;
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
            showLoading('Loading session...');
            try {
                const data = await apiGetCapSession(serverSessionId, serverSessionKey);
                const askedIds = mapAskedToIds(data.asked || []);
                const base = Date.now();
                const timestamps = askedIds.map((_, i) => base - (askedIds.length - 1 - i) * 1000);
                const answers = (data && data.answers && typeof data.answers === 'object') ? data.answers : {};
                const idToAnswer = {};
                for (const [text, value] of Object.entries(answers)) {
                    const entry = Array.from(idMap.byId.values()).find(q => q && q.text === text);
                    if (entry && typeof value === 'string' && value.trim() !== '') idToAnswer[String(entry.id)] = value;
                }
                let currentId = null;
                if (data.currentQuestionId && idMap.byId.has(String(data.currentQuestionId))) {
                    currentId = String(data.currentQuestionId);
                } else if (data.currentQuestion && data.currentQuestion.text) {
                    const currentQuestion = Array.from(idMap.byId.values()).find(q => q && q.text === data.currentQuestion.text);
                    if (currentQuestion) {
                        currentId = currentQuestion.id;
                    }
                }
                if (!currentId) {
                    const storedId = readPersistedCurrent();
                    if (storedId && idMap.byId.has(storedId)) {
                        currentId = storedId;
                    }
                }

                activeSession = { name: data.name || 'session', askedIds, timestamps, answers: idToAnswer, currentId: currentId || null };
                window.__activeSessionName = activeSession.name;

                if (currentId) {
                    isPreview = false;
                    persistCurrentQuestion(currentId);
                    renderQuestionById(currentId, { persist: false });
                } else {
                    const askedSet = new Set(activeSession.askedIds);
                    const nextId = window.SelectionUtils.nextQuestionId(idMap.order, askedSet);
                    if (nextId) {
                        isPreview = false;
                        try {
                            const payload = questionPayloadById(nextId);
                            if (isServerMode && payload) {
                                await apiPatchCap(serverSessionId, serverSessionKey, { action: 'setCurrentQuestion', question: payload });
                            }
                        } catch (e) {
                            console.error('Failed to sync current question to server:', e);
                        }
                        persistCurrentQuestion(nextId);
                        renderQuestionById(nextId, { persist: false });
                    } else {
                        renderQuestionById(null, { persist: false });
                        persistCurrentQuestion(null);
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
                toast('Failed to load session', { type: 'error' });
            } finally {
                hideLoading();
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

            try {
                const textarea = document.getElementById('answerText');
                const initial = (function() {
                    if (isServerMode && activeSession && activeSession.answers && typeof activeSession.answers === 'object') {
                        const v = activeSession.answers[String(id)];
                        return typeof v === 'string' ? v : '';
                    }
                    return (activeSession && window.SessionStore && typeof window.SessionStore.getAnswer === 'function') ? window.SessionStore.getAnswer(activeSession.name, id) : '';
                })();
                textarea.value = initial;
                textarea.addEventListener('blur', async () => {
                    if (!activeSession) return;
                    const val = textarea.value || '';
                    if (isServerMode) {
                        try {
                            const payload = questionPayloadById(id);
                            const body = { action: 'setAnswer', question: payload || { text: id && question ? question.text : '' }, value: val };
                            await apiPatchCap(serverSessionId, serverSessionKey, body);
                            if (!activeSession.answers || typeof activeSession.answers !== 'object') activeSession.answers = {};
                            activeSession.answers[String(id)] = val;
                            if (askedContainer && window.AskedList) {
                                const answeredIds = Object.entries(activeSession.answers || {}).filter(([,v]) => typeof v === 'string' && v.trim() !== '').map(([k]) => String(k));
                                window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps, answeredIds });
                            }
                        } catch (e) {
                            console.error('Failed to save answer to server:', e);
                            toast('Failed to save answer');
                        }
                    } else if (window.SessionStore && typeof window.SessionStore.setAnswer === 'function') {
                        window.SessionStore.setAnswer(activeSession.name, id, val);
                        activeSession = window.SessionStore.open(activeSession.name);
                        if (askedContainer && window.AskedList) {
                            const answeredIds = Object.entries(activeSession.answers || {}).filter(([,v]) => typeof v === 'string' && v.trim() !== '').map(([k]) => String(k));
                            window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps, answeredIds });
                        }
                    }
                });
            } catch (e) {
                console.error('Failed to setup answer handler:', e);
            }
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

        async function onOpenSession(name) {
            if (!name) return;

            // BUG FIX #1: In admin mode, sessions cannot be "opened" without capability keys
            // The capability keys are only shown once at creation and cannot be recovered
            const isAdminMode = window.location.href.includes('admin=1');
            if (isAdminMode) {
                toast('Sessions can only be accessed via their unique capability link. Please use the share link shown when you created the session.', {
                    type: 'error',
                    duration: 5000
                });
                return;
            }

            if (isServerMode) {
                activeSession = activeSession && activeSession.name ? activeSession : { name, askedIds: [], timestamps: [] };
                window.__activeSessionName = name;
            } else {
                activeSession = window.SessionStore.open(name);
            }
            window.__activeSessionName = activeSession.name;
            if (activeSession.currentId) {
                isPreview = false;
                persistCurrentQuestion(activeSession.currentId);
                renderQuestionById(activeSession.currentId, { persist: false });
            } else {
                const askedSet = new Set(activeSession.askedIds);
                const nextId = window.SelectionUtils.nextQuestionId(idMap.order, askedSet);
                if (nextId) {
                    isPreview = false;
                    if (historyChip) historyChip.classList.add('hidden');

                    if (isServerMode) {
                        const payload = questionPayloadById(nextId);
                        try {
                            if (payload) await apiPatchCap(serverSessionId, serverSessionKey, { action: 'setCurrentQuestion', question: payload });
                        } catch (e) {
                            console.error('Failed to sync current question to server:', e);
                        }
                    }
                    persistCurrentQuestion(nextId);
                    renderQuestionById(nextId, { persist: !isServerMode });
                } else {
                    renderQuestionById(null, { persist: false });
                    isPreview = false;
                    persistCurrentQuestion(null);
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
                        const qObj = idMap.byId.get(currentQuestionId);
                        const payload = questionPayloadById(currentQuestionId);
                        const baseQuestion = payload || (qObj ? { text: qObj.text, theme: qObj.theme } : { text: '' });
                        await apiPatchCap(serverSessionId, serverSessionKey, { action: 'setAnswer', question: baseQuestion, value: val });
                        if (!activeSession.answers || typeof activeSession.answers !== 'object') activeSession.answers = {};
                        activeSession.answers[String(currentQuestionId)] = val;
                    } else if (window.SessionStore && typeof window.SessionStore.setAnswer === 'function') {
                        window.SessionStore.setAnswer(activeSession.name, currentQuestionId, val);
                    }
                }
            } catch (e) {
                console.error('Failed to save answer before advancing:', e);
                toast('Failed to save answer');
                isAdvancing = false;
                return;
            }
            // Record the currently shown question as asked, whether preview or not.
            if (currentQuestionId) {
                if (isServerMode) {
                    const qObj = idMap.byId.get(currentQuestionId);
                    const payload = questionPayloadById(currentQuestionId);
                    const baseQuestion = payload || (qObj ? { text: qObj.text, theme: qObj.theme } : { text: '' });
                    try {
                        await apiPatchCap(serverSessionId, serverSessionKey, { action: 'markAsked', question: baseQuestion });
                        const now = Date.now();
                        activeSession.askedIds = (activeSession.askedIds || []).concat([currentQuestionId]);
                        activeSession.timestamps = (activeSession.timestamps || []).concat([now]);
                    } catch (e) {
                        console.error('Failed to mark question as asked on server:', e);
                        toast('Failed to sync question status');
                    }
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
            if (isServerMode && nextId) {
                const payload = questionPayloadById(nextId);
                try {
                    if (payload) await apiPatchCap(serverSessionId, serverSessionKey, { action: 'setCurrentQuestion', question: payload });
                } catch (e) {
                    console.error('Failed to sync next question to server:', e);
                }
            }
            persistCurrentQuestion(nextId);
            renderQuestionById(nextId, { persist: !isServerMode });
            isPreview = false;
            if (historyChip) historyChip.classList.add('hidden');

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
                } catch (e) {
                    console.error('Failed to undo question on server:', e);
                    toast('Failed to undo');
                    return;
                }
            } else {
                last = window.SessionStore.removeLastAsked(activeSession.name);
                activeSession = window.SessionStore.open(activeSession.name);
            }
            if (last) {
                renderQuestionById(last, { persist: true });
                persistCurrentQuestion(last);
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
                activeSession.answers = {};
                activeSession.currentId = null;
            } else {
                window.SessionStore.reset(activeSession.name);
                activeSession = window.SessionStore.open(activeSession.name);
            }
            renderQuestionById(null);
            persistCurrentQuestion(null);
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

                // Only used in admin mode - sessions will be loaded after authentication
                const sessions = [];

                window.SessionPicker.render(container, {
                    sessions: sessions,
                    onOpen: onOpenSession
                });
            }
        }

        // Check if user has seen welcome screen
        function hasSeenWelcome() {
            // Skip welcome screen in test environment
            if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
                return true;
            }
            // Skip welcome screen in admin mode
            try {
                const u = new URL(window.location.href);
                if (u.searchParams.get('admin') === '1') {
                    return true;
                }
            } catch {}
            try {
                return localStorage.getItem('mfq_seen_welcome') === 'true';
            } catch {
                return false;
            }
        }
        function markWelcomeSeen() {
            try {
                localStorage.setItem('mfq_seen_welcome', 'true');
            } catch {}
        }

        function showWelcomeScreen(onContinue) {
            const overlay = document.createElement('div');
            overlay.id = 'welcomeOverlay';
            overlay.className = 'fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50';
            const dialog = document.createElement('div');
            dialog.className = 'bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'welcomeTitle');
            dialog.tabIndex = -1;
            dialog.innerHTML = `
                <div class="text-center mb-6">
                    <div class="text-indigo-600 text-5xl mb-4">
                        <i class="fas fa-comments"></i>
                    </div>
                    <h2 id="welcomeTitle" class="text-2xl font-bold text-gray-900 mb-2">Welcome to Manager Feedback Questions</h2>
                    <p class="text-gray-600">Your companion for better 1-on-1 conversations</p>
                </div>
                <div class="space-y-4 mb-6 text-left">
                    <div class="flex items-start gap-3">
                        <div class="text-indigo-600 text-xl mt-1"><i class="fas fa-question-circle"></i></div>
                        <div>
                            <h3 class="font-semibold text-gray-900">Curated Questions</h3>
                            <p class="text-sm text-gray-600">Get thoughtful questions across 7 themes to improve team dynamics</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <div class="text-indigo-600 text-xl mt-1"><i class="fas fa-folder"></i></div>
                        <div>
                            <h3 class="font-semibold text-gray-900">Track Sessions</h3>
                            <p class="text-sm text-gray-600">Create separate sessions for each team member or meeting</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <div class="text-indigo-600 text-xl mt-1"><i class="fas fa-history"></i></div>
                        <div>
                            <h3 class="font-semibold text-gray-900">Never Repeat</h3>
                            <p class="text-sm text-gray-600">Questions are tracked so you won't see the same one twice</p>
                        </div>
                    </div>
                </div>
                <button id="welcomeContinueBtn" class="btn-primary w-full text-white font-semibold py-3 px-6 rounded-lg">
                    Get Started
                </button>
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

            const continueBtn = dialog.querySelector('#welcomeContinueBtn');
            continueBtn.addEventListener('click', () => {
                overlay.remove();
                document.body.style.overflow = prevOverflow;
                document.body.style.paddingRight = prevPaddingRight;
                markWelcomeSeen();
                if (typeof onContinue === 'function') onContinue();
            });

            setTimeout(() => { try { continueBtn.focus(); } catch {} }, 100);
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
                const adminSessionsBtn = document.getElementById('adminSessionsBtn');
                if (adminSessionsBtn) adminSessionsBtn.classList.add('hidden');
                if (questionCard) questionCard.classList.add('hidden');
            } catch {}

            // Check if we're in admin mode
            const isAdminMode = window.location.href.includes('admin=1');

            // In admin mode, AdminUI.init() will handle showing the session management UI
            if (isAdminMode) {
                return;
            }

            // For regular users, lockApp() is called to hide UI while showing session creation dialog
        }

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
                    if (typeof window.openShareLinksDialog === 'function') {
                        window.openShareLinksDialog(links);
                    }
                    setTimeout(() => {
                        window.location.href = links.edit;
                    }, 500);
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
            } catch {}
            const overlay = document.getElementById('sessionGateOverlay');
            if (overlay) {
                if (typeof overlay._restore === 'function') { try { overlay._restore(); } catch {} }
                overlay.remove();
            }
        }
        
        // init: determine mode on load
        const isAdminMode = (() => {
            try {
                const params = new URLSearchParams(window.location.search);
                return params.get('admin') === '1';
            } catch {
                return false;
            }
        })();

        if (isServerMode) {
            // User has capability link - load their session
            serverLoadAndOpen();
        } else if (isAdminMode) {
            // Admin mode - show session management
            lockApp();
        } else {
            // Regular user on homepage - prompt to create a new session
            lockApp(); // Hide UI elements while showing creation prompt
            showCreateSessionDialog();
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
                        persistCurrentQuestion(cur);
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

    function formatTimestamp(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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
            <div class="border-t pt-4 flex items-center justify-between gap-3">
                <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" id="confirmSaved" class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                    <span>I've saved these links</span>
                </label>
                <button id="shareClose" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all" disabled>
                    Close
                </button>
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

        // Enable close button only when checkbox is checked
        const closeBtn = dialog.querySelector('#shareClose');
        const checkbox = dialog.querySelector('#confirmSaved');
        if (checkbox && closeBtn) {
            checkbox.addEventListener('change', () => {
                closeBtn.disabled = !checkbox.checked;
            });
        }

        closeBtn.addEventListener('click', () => close());

        // Auto-select first input for easy copying
        setTimeout(() => {
            try {
                const editInput = dialog.querySelector('#shareEditInput');
                if (editInput) editInput.focus();
            } catch {}
        }, 100);
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
            lockApp();
            loadAdminSessions(adminKey, sessions);
        } catch (e) {
            hideLoading();
            toast('Failed to load sessions', { type: 'error' });
            console.error('Failed to refresh sessions:', e);
        }
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
            // Prevent dismissing the admin dialog - must authenticate
            if (e.key === 'Escape') { e.preventDefault(); }
            if (e.key === 'Enter') { e.preventDefault(); confirmBtn.click(); }
        });
        // Don't allow cancel - must provide valid admin key
        cancelBtn.style.display = 'none';
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
