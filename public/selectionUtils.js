(function() {
        function stableIdFor(question, idx) {
                if (question && question.id) return String(question.id);
                const text = (question && question.text) || '';
                let hash = 0;
                for (let i = 0; i < text.length; i++) {
                        hash = ((hash << 5) - hash) + text.charCodeAt(i);
                        hash |= 0;
                }
                return String(idx) + ':' + Math.abs(hash);
        }

        function buildIdMap(questions) {
                const byId = new Map();
                const order = [];
                questions.forEach((q, i) => {
                        const id = stableIdFor(q, i);
                        const enriched = { id, ...q };
                        byId.set(id, enriched);
                        order.push(id);
                });
                return { byId, order };
        }

        function nextQuestionId(allIds, askedSet) {
                const remaining = allIds.filter(id => !askedSet.has(id));
                if (remaining.length === 0) return null;
                const idx = Math.floor(Math.random() * remaining.length);
                return remaining[idx];
        }

        const SelectionUtils = { stableIdFor, buildIdMap, nextQuestionId };
        if (typeof module !== 'undefined') module.exports = SelectionUtils;
        if (typeof window !== 'undefined') window.SelectionUtils = SelectionUtils;
})();


