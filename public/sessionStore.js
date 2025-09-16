(function() {
        function safeParse(json, fallback) {
                try { return JSON.parse(json); } catch { return fallback; }
        }

        const INDEX_KEY = 'sessions:index';
        function sanitize(list) {
                const seen = new Set();
                const out = [];
                (Array.isArray(list) ? list : []).forEach(name => {
                        const trimmed = typeof name === 'string' ? name.trim() : '';
                        if (!trimmed) return;
                        if (seen.has(trimmed)) return;
                        seen.add(trimmed);
                        out.push(trimmed);
                });
                return out;
        }
        function getIndex() {
                const raw = localStorage.getItem(INDEX_KEY);
                const arr = safeParse(raw, []);
                const clean = sanitize(arr);
                // Self-heal stored index if it changed
                if (JSON.stringify(arr) !== JSON.stringify(clean)) {
                        try { localStorage.setItem(INDEX_KEY, JSON.stringify(clean)); } catch {}
                }
                return clean;
        }

        function setIndex(list) {
                try { localStorage.setItem(INDEX_KEY, JSON.stringify(sanitize(list))); } catch {}
        }

        function upsertIndex(name) {
                const trimmed = (name || '').trim();
                if (!trimmed) return;
                const list = getIndex().filter(n => n !== trimmed);
                list.unshift(trimmed);
                setIndex(list);
        }

        function exists(name) {
                const trimmed = (name || '').trim();
                if (!trimmed) return false;
                return getIndex().includes(trimmed);
        }

        function keyFor(name) { return `session:${name}`; }

        function migrateIfNeeded(session) {
                if (!session || typeof session !== 'object') return { name: '', askedIds: [], timestamps: [], updatedAt: Date.now(), currentId: null, currentViewedAt: 0, answers: {} };
                const asked = new Set(Array.isArray(session.askedIds) ? session.askedIds : []);
                if (Array.isArray(session.skippedIds)) {
                        for (const id of session.skippedIds) asked.add(id);
                }
                // legacy shapes with arrays of question objects
                if (Array.isArray(session.asked)) {
                        for (const q of session.asked) { if (q && q.id) asked.add(String(q.id)); }
                }
                if (Array.isArray(session.skipped)) {
                        for (const q of session.skipped) { if (q && q.id) asked.add(String(q.id)); }
                }
                const askedIds = Array.from(asked);
                let timestamps = Array.isArray(session.timestamps) ? session.timestamps.slice() : [];
                // Ensure timestamps aligns with askedIds length
                if (timestamps.length !== askedIds.length) {
                        const base = session.updatedAt || Date.now();
                        timestamps = askedIds.map((_, i) => base - (askedIds.length - 1 - i) * 1000);
                }
                const currentId = typeof session.currentId === 'string' || session.currentId === null ? session.currentId : null;
                const currentViewedAt = typeof session.currentViewedAt === 'number' ? session.currentViewedAt : 0;
                const answers = (session.answers && typeof session.answers === 'object') ? session.answers : {};
                return { name: session.name || '', askedIds, timestamps, updatedAt: session.updatedAt || Date.now(), currentId, currentViewedAt, answers };
        }

        function read(name) {
                const raw = localStorage.getItem(keyFor(name));
                return migrateIfNeeded(safeParse(raw, null));
        }

        function write(session) {
                try { localStorage.setItem(keyFor(session.name), JSON.stringify(session)); } catch {}
        }

        function create(name) {
                const trimmed = (name || '').trim();
                if (!trimmed) throw new Error('Invalid name');
                if (exists(trimmed)) throw new Error('Session already exists');
                const session = { name: trimmed, askedIds: [], timestamps: [], updatedAt: Date.now(), currentId: null, currentViewedAt: 0, answers: {} };
                write(session);
                upsertIndex(trimmed);
        }

        function open(name) {
                const trimmed = (name || '').trim();
                if (!trimmed) throw new Error('Invalid name');
                const session = read(trimmed) || { name: trimmed, askedIds: [], timestamps: [], updatedAt: Date.now(), currentId: null, currentViewedAt: 0, answers: {} };
                // Ensure index is updated
                upsertIndex(trimmed);
                write(session);
                return session;
        }

        function addAsked(name, id) {
                const s = open(name);
                const strId = String(id);
                if (!Array.isArray(s.timestamps)) s.timestamps = [];
                if (!s.askedIds.includes(strId)) {
                        s.askedIds.push(strId);
                        s.timestamps.push(Date.now());
                }
                s.updatedAt = Date.now();
                write(s);
        }

        function removeLastAsked(name) {
                const s = open(name);
                const id = s.askedIds.pop();
                if (Array.isArray(s.timestamps)) s.timestamps.pop();
                s.updatedAt = Date.now();
                write(s);
                return id;
        }

        function reset(name) {
                const s = open(name);
                s.askedIds = [];
                s.timestamps = [];
                s.currentId = null;
                s.currentViewedAt = 0;
                s.answers = {};
                s.updatedAt = Date.now();
                write(s);
        }

        function remove(name) {
                const trimmed = (name || '').trim();
                if (!trimmed) return;
                try { localStorage.removeItem(keyFor(trimmed)); } catch {}
                const list = getIndex().filter(n => n !== trimmed);
                setIndex(list);
        }

        function setCurrent(name, id) {
                const s = open(name);
                s.currentId = id ? String(id) : null;
                s.currentViewedAt = s.currentId ? Date.now() : 0;
                s.updatedAt = Date.now();
                write(s);
                return s;
        }

        function setAnswer(name, id, value) {
                const s = open(name);
                if (!s.answers || typeof s.answers !== 'object') s.answers = {};
                const key = id ? String(id) : '';
                if (!key) return s;
                s.answers[key] = String(value || '');
                s.updatedAt = Date.now();
                write(s);
                return s;
        }

        function getAnswer(name, id) {
                const s = open(name);
                const key = id ? String(id) : '';
                if (!key) return '';
                const val = s.answers && typeof s.answers === 'object' ? s.answers[key] : '';
                return typeof val === 'string' ? val : '';
        }

        function hasAnswers(name) {
                const s = open(name);
                const obj = s.answers && typeof s.answers === 'object' ? s.answers : {};
                for (const k in obj) {
                        if (Object.prototype.hasOwnProperty.call(obj, k) && typeof obj[k] === 'string' && obj[k].trim() !== '') return true;
                }
                return false;
        }

        const SessionStore = {
                getAll: getIndex,
                exists,
                create,
                open,
                addAsked,
                removeLastAsked,
                reset,
                upsertIndex,
                migrateIfNeeded,
                setCurrent,
                remove,
                setAnswer,
                getAnswer,
                hasAnswers,
        };

        if (typeof module !== 'undefined') module.exports = SessionStore;
        if (typeof window !== 'undefined') window.SessionStore = SessionStore;
})();


