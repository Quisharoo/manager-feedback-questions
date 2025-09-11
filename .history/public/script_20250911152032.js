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
        const getQuestionBtn = document.getElementById('getQuestionBtn');
        const prevQuestionBtn = document.getElementById('prevQuestionBtn');
        const createSessionBtn = document.getElementById('createSessionBtn');
        const sessionNameInput = document.getElementById('sessionNameInput');
        const sessionInfo = document.getElementById('sessionInfo');
        const sessionNameEl = document.getElementById('sessionName');
        const progressCounts = document.getElementById('progressCounts');
        const markAskedBtn = document.getElementById('markAskedBtn');
        const skipBtn = document.getElementById('skipBtn');
        const undoBtn = document.getElementById('undoBtn');
        const resetBtn = document.getElementById('resetBtn');
        let questionTimeout;
        let pulseTimeout;

        let availableQuestions = [...questions];
        let history = [];
        let historyIndex = -1;
        let sessionId = null;
        let currentQuestion = null;

        function getQueryParam(name) {
            const params = new URLSearchParams(window.location.search);
            return params.get(name);
        }

        async function api(method, url, body) {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) throw new Error('Request failed');
            return res.json();
        }

        function setButtonsVisibility(hasSession) {
            const method = hasSession ? 'remove' : 'add';
            markAskedBtn.classList[hasSession ? 'remove' : 'add']('hidden');
            skipBtn.classList[hasSession ? 'remove' : 'add']('hidden');
            undoBtn.classList[hasSession ? 'remove' : 'add']('hidden');
            resetBtn.classList[hasSession ? 'remove' : 'add']('hidden');
        }

        async function loadSession(id) {
            try {
                const s = await api('GET', `/api/sessions/${id}`);
                sessionId = s.id;
                sessionInfo.classList.remove('hidden');
                sessionNameEl.textContent = s.name || '(unnamed)';
                progressCounts.textContent = `${s.asked.length} asked, ${s.skipped.length} skipped`;
                setButtonsVisibility(true);
            } catch (e) {
                // if invalid id, ignore
            }
        }

        function updatePrevButton() {
            if (history.length > 1) {
                prevQuestionBtn.classList.remove('hidden');
                if (historyIndex === 0) {
                    prevQuestionBtn.setAttribute('disabled', '');
                    prevQuestionBtn.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    prevQuestionBtn.removeAttribute('disabled');
                    prevQuestionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            } else {
                prevQuestionBtn.classList.add('hidden');
            }
        }

        function renderQuestion(question) {
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

            currentQuestion = question;
        }

        getQuestionBtn.addEventListener('click', () => {
            getQuestionBtn.classList.remove('pulse');

            clearTimeout(questionTimeout);
            clearTimeout(pulseTimeout);

            questionContainer.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                    <p class="text-gray-500">Finding your question...</p>
                </div>
            `;

            questionTimeout = setTimeout(() => {
                let nextQuestion;
                if (historyIndex < history.length - 1) {
                    historyIndex++;
                    nextQuestion = history[historyIndex];
                } else {
                    if (availableQuestions.length === 0) {
                        availableQuestions = [...questions];
                    }
                    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
                    nextQuestion = availableQuestions.splice(randomIndex, 1)[0];
                    history.push(nextQuestion);
                    historyIndex = history.length - 1;
                }

                renderQuestion(nextQuestion);

                pulseTimeout = setTimeout(() => {
                    getQuestionBtn.classList.add('pulse');
                }, 2000);

                updatePrevButton();
            }, 800);
        });

        prevQuestionBtn.addEventListener('click', () => {
            if (historyIndex <= 0) return;
            getQuestionBtn.classList.remove('pulse');
            clearTimeout(questionTimeout);
            clearTimeout(pulseTimeout);

            questionContainer.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                    <p class="text-gray-500">Finding your question...</p>
                </div>
            `;

            questionTimeout = setTimeout(() => {
                historyIndex--;
                const prevQuestion = history[historyIndex];
                renderQuestion(prevQuestion);

                pulseTimeout = setTimeout(() => {
                    getQuestionBtn.classList.add('pulse');
                }, 2000);

                updatePrevButton();
            }, 800);
        });

        createSessionBtn.addEventListener('click', async () => {
            const name = sessionNameInput.value.trim();
            if (!name) return;
            try {
                const s = await api('POST', '/api/sessions', { name });
                // redirect to include ?s=
                const params = new URLSearchParams(window.location.search);
                params.set('s', s.id);
                const newUrl = `${window.location.pathname}?${params.toString()}`;
                window.history.replaceState({}, '', newUrl);
                await loadSession(s.id);
            } catch (e) {}
        });

        markAskedBtn.addEventListener('click', async () => {
            if (!sessionId || !currentQuestion) return;
            try {
                const s = await api('PATCH', `/api/sessions/${sessionId}`, { action: 'markAsked', question: currentQuestion });
                progressCounts.textContent = `${s.asked.length} asked, ${s.skipped.length} skipped`;
            } catch (e) {}
        });

        skipBtn.addEventListener('click', async () => {
            if (!sessionId || !currentQuestion) return;
            try {
                const s = await api('PATCH', `/api/sessions/${sessionId}`, { action: 'markSkipped', question: currentQuestion });
                progressCounts.textContent = `${s.asked.length} asked, ${s.skipped.length} skipped`;
            } catch (e) {}
        });

        undoBtn.addEventListener('click', async () => {
            if (!sessionId) return;
            try {
                const s = await api('PATCH', `/api/sessions/${sessionId}`, { action: 'undoAsked' });
                progressCounts.textContent = `${s.asked.length} asked, ${s.skipped.length} skipped`;
            } catch (e) {}
        });

        resetBtn.addEventListener('click', async () => {
            if (!sessionId) return;
            try {
                const s = await api('PATCH', `/api/sessions/${sessionId}`, { action: 'reset' });
                progressCounts.textContent = `${s.asked.length} asked, ${s.skipped.length} skipped`;
            } catch (e) {}
        });

        // Initialize from query param
        const fromQuery = getQueryParam('s');
        if (fromQuery) {
            loadSession(fromQuery);
        }

        // show buttons if session exists
        setButtonsVisibility(!!fromQuery);
