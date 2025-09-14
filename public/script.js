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
        const sessionBadge = document.getElementById('sessionBadge');
        const historyChip = document.getElementById('historyChip');

        const idMap = window.SelectionUtils.buildIdMap(questions);
        let activeSession = null; // { name, askedIds, timestamps }
        let currentQuestionId = null;
        let isPreview = false;
        let isAdvancing = false;
        let resetUndoTimer = null;

        function renderQuestionById(id, { persist } = { persist: false }) {
            const question = id ? idMap.byId.get(id) : null;
            if (!id || !question) {
                questionContainer.innerHTML = `
                <div class="p-8 text-center">
                    <div class="text-indigo-400 text-6xl mb-4">
                        <i class="fas fa-question-circle"></i>
                    </div>
                    <p class="text-gray-500 italic">Press Next to get a feedback question</p>
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
                <p class="text-xl md:text-2xl text-gray-800 font-medium mb-4">${question.text}</p>
                <div class="${themeClass.split(' ')[1]} text-4xl">
                    <i class="fas fa-quote-right"></i>
                </div>
            `;
            document.querySelector('.question-card').classList.add('transform', 'scale-105');
            setTimeout(() => {
                document.querySelector('.question-card').classList.remove('transform', 'scale-105');
            }, 300);
            currentQuestionId = id;
            if (persist && activeSession && !isPreview && window.SessionStore && typeof window.SessionStore.setCurrent === 'function') {
                window.SessionStore.setCurrent(activeSession.name, id);
                activeSession = window.SessionStore.open(activeSession.name);
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

        function onOpenSession(name) {
            if (!name) return;
            activeSession = window.SessionStore.open(name);
            window.__activeSessionName = activeSession.name;
            if (activeSession.currentId) {
                renderQuestionById(activeSession.currentId, { persist: false });
            } else {
                renderQuestionById(null, { persist: false });
            }
            updateSessionInfo();
            if (askedContainer && window.AskedList) window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps });
            if (exhaustedBanner) exhaustedBanner.classList.add('hidden');
            if (nextBtn && typeof nextBtn.focus === 'function') { try { nextBtn.focus(); } catch {} }
        }

        function onCreateSession(name) {
            const trimmed = (name || '').trim();
            if (!trimmed) return;
            if (!window.SessionStore.exists(trimmed)) {
                try { window.SessionStore.create(trimmed); } catch {}
            }
            if (sessionSection && window.SessionPicker) {
                window.SessionPicker.updateSessions(sessionSection, window.SessionStore.getAll());
            }
            onOpenSession(trimmed);
        }

        nextBtn.addEventListener('click', () => {
            if (isAdvancing) return;
            if (!activeSession) {
                const sel = sessionSelect && sessionSelect.value;
                if (sel) {
                    activeSession = window.SessionStore.open(sel);
                    updateSessionInfo();
                } else {
                    return;
                }
            }
            isAdvancing = true;
            if (currentQuestionId && !isPreview) {
                window.SessionStore.addAsked(activeSession.name, currentQuestionId);
                activeSession = window.SessionStore.open(activeSession.name);
            }
            const askedSet = new Set(activeSession.askedIds);
            const nextId = window.SelectionUtils.nextQuestionId(idMap.order, askedSet);
            if (!nextId) {
                if (exhaustedBanner) exhaustedBanner.classList.remove('hidden');
                updateSessionInfo();
                isAdvancing = false;
                return;
            }
            renderQuestionById(nextId, { persist: true });
            isPreview = false;
            if (historyChip) historyChip.classList.add('hidden');
            updateSessionInfo();
            if (askedContainer && window.AskedList) window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps });
            isAdvancing = false;
        });

        undoBtn.addEventListener('click', () => {
            if (!activeSession) {
                const sel = sessionSelect && sessionSelect.value;
                if (sel) activeSession = window.SessionStore.open(sel); else return;
            }
            const last = window.SessionStore.removeLastAsked(activeSession.name);
            activeSession = window.SessionStore.open(activeSession.name);
            if (last) {
                renderQuestionById(last, { persist: true });
            }
            isPreview = false;
            if (historyChip) historyChip.classList.add('hidden');
            updateSessionInfo();
            if (askedContainer && window.AskedList) window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps });
            if (exhaustedBanner) exhaustedBanner.classList.add('hidden');
        });

        function performReset() {
            if (!activeSession) return;
            window.SessionStore.reset(activeSession.name);
            activeSession = window.SessionStore.open(activeSession.name);
            renderQuestionById(null);
            updateSessionInfo();
            if (askedContainer && window.AskedList) window.AskedList.update(askedContainer, { askedIds: activeSession.askedIds, timestamps: activeSession.timestamps });
            if (exhaustedBanner) exhaustedBanner.classList.add('hidden');
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
                <div class="text-sm mb-3">Reset asked questions for <span class="font-semibold">${name}</span>?</div>
                <div class="flex justify-end gap-2">
                    <button id="resetCancel" class="px-3 py-1 border border-gray-300 rounded">Cancel</button>
                    <button id="resetConfirm" class="btn-primary text-white px-3 py-1 rounded">Reset</button>
                </div>`;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            const prevOverflow = document.body.style.overflow;
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

        resetBtn.addEventListener('click', () => {
            if (!activeSession) {
                const sel = sessionSelect && sessionSelect.value;
                if (sel) activeSession = window.SessionStore.open(sel); else return;
            }
            confirmReset();
        });

        if (exhaustResetBtn) exhaustResetBtn.addEventListener('click', () => resetBtn.click());
        if (exhaustNewBtn) exhaustNewBtn.addEventListener('click', () => {
            if (sessionSection && window.SessionPicker) {
                // activate New tab
                const tabNew = sessionSection.querySelector('#tab-new');
                if (tabNew) tabNew.click();
            }
        });
        
        // init
        if (sessionSection && window.SessionPicker) {
            window.SessionPicker.render(sessionSection, {
                sessions: window.SessionStore.getAll(),
                onOpen: onOpenSession,
                onCreate: onCreateSession,
            });
        }
        if (askedContainer && window.AskedList) {
            const questionsById = new Map();
            idMap.order.forEach(id => { const q = idMap.byId.get(id); if (q) questionsById.set(id, q); });
            window.AskedList.render(askedContainer, { askedIds: [], timestamps: [], questionsById, onSelect: (id) => {
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
                if (exhaustedBanner) exhaustedBanner.classList.add('hidden');
            }});
        }
        renderQuestionById(null, { persist: false });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const tag = (e.target && e.target.tagName) || '';
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
            if (isInput) return;
            if (e.key === 'n' || e.key === 'N') { e.preventDefault(); nextBtn.click(); }
            if (e.key === 'u' || e.key === 'U') { e.preventDefault(); if (!undoBtn.disabled) undoBtn.click(); }
            if (e.key === 'r' || e.key === 'R') { e.preventDefault(); if (!resetBtn.disabled) resetBtn.click(); }
        });
