/**
 * UI Utilities
 * Shared utilities for toast notifications, loading states, and formatters
 */
(function(global) {
    'use strict';

    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Toast notification system
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
        t.innerHTML = `${icon}<span>${escapeHtml(msg)}</span>`;
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

    // Loading state management
    let loadingOverlay = null;
    function showLoading(message = 'Loading...') {
        if (loadingOverlay) return; // Prevent multiple overlays
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center">
                <div class="loading-spinner-large mb-3"></div>
                <div class="text-gray-700 text-sm">${escapeHtml(message)}</div>
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

    // Timestamp formatter (relative time)
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

    // Scroll lock utilities (for modals/dialogs)
    function lockScrollBar() {
        const prevOverflow = document.body.style.overflow;
        const prevPaddingRight = document.body.style.paddingRight;
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

        if (scrollBarWidth > 0) {
            document.body.style.paddingRight = `${scrollBarWidth}px`;
        }
        document.body.style.overflow = 'hidden';

        return {
            restore: () => {
                document.body.style.overflow = prevOverflow;
                document.body.style.paddingRight = prevPaddingRight;
            }
        };
    }

    function unlockScrollBar(prevOverflow, prevPaddingRight) {
        document.body.style.overflow = prevOverflow || '';
        document.body.style.paddingRight = prevPaddingRight || '';
    }

    // Export as global and module
    const utils = {
        toast,
        showLoading,
        hideLoading,
        formatTimestamp,
        lockScrollBar,
        unlockScrollBar
    };

    // Make available globally
    if (global) {
        global.UIUtils = utils;
        // Also expose individual functions for backwards compatibility
        global.toast = toast;
        global.showLoading = showLoading;
        global.hideLoading = hideLoading;
        global.formatTimestamp = formatTimestamp;
    }

    // CommonJS export for tests
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = utils;
    }
})(typeof window !== 'undefined' ? window : globalThis);
