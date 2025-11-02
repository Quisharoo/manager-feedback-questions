(function (global) {
        async function handleJsonResponse(response) {
                const data = await response.json().catch(() => ({}));
                return { ok: response.ok, status: response.status, data };
        }

        async function createCapabilitySession(name) {
                if (!name || typeof name !== 'string' || !name.trim()) {
                        throw new Error('Session name is required');
                }
                const payload = { name: name.trim() };
                const res = await fetch('/api/capsessions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                });
                const { ok, data, status } = await handleJsonResponse(res);
                if (!ok) {
                        const message = (data && data.error) || 'Failed to create session';
                        const err = new Error(message);
                        err.status = status;
                        throw err;
                }
                if (!data || !data.links || typeof data.links.edit !== 'string' || typeof data.links.view !== 'string') {
                        const err = new Error('Unexpected response from server');
                        err.status = status;
                        err.details = data;
                        throw err;
                }
                return data;
        }

        async function fetchAdminSessions(adminKey) {
                const key = typeof adminKey === 'string' ? adminKey.trim() : '';
                if (!key) {
                        const err = new Error('Admin key is required');
                        err.status = 400;
                        throw err;
                }
                const res = await fetch('/api/admin/sessions', {
                        headers: { Authorization: 'Key ' + key }
                });
                const { ok, data, status } = await handleJsonResponse(res);
                if (!ok) {
                        const message = (data && data.error) || 'Invalid admin key';
                        const err = new Error(message);
                        err.status = status;
                        throw err;
                }
                if (!data || !Array.isArray(data.sessions)) {
                        const err = new Error('Unexpected admin session response');
                        err.status = status;
                        err.details = data;
                        throw err;
                }
                return data;
        }

        async function deleteAdminSession(id, adminKey) {
                const key = typeof adminKey === 'string' ? adminKey.trim() : '';
                if (!key) {
                        const err = new Error('Admin key is required');
                        err.status = 400;
                        throw err;
                }
                const sessionId = typeof id === 'string' ? id.trim() : '';
                if (!sessionId) {
                        const err = new Error('Session id is required');
                        err.status = 400;
                        throw err;
                }
                const res = await fetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, {
                        method: 'DELETE',
                        headers: { Authorization: 'Key ' + key }
                });
                const { ok, data, status } = await handleJsonResponse(res);
                if (!ok) {
                        const message = (data && data.error) || 'Failed to delete session';
                        const err = new Error(message);
                        err.status = status;
                        throw err;
                }
                return data;
        }

        const api = {
                createCapabilitySession,
                fetchAdminSessions,
                deleteAdminSession
        };

        if (global) {
                const existing = global.SessionApi || {};
                global.SessionApi = Object.assign({}, existing, api);
        }

        if (typeof module !== 'undefined') {
                module.exports = api;
        }
})(typeof window !== 'undefined' ? window : globalThis);
