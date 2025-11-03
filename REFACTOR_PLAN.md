# Script.js Refactoring Plan

## 🎯 Goal
Reduce `script.js` from 1,641 lines to ~700 lines by extracting reusable modules.

## 📊 Current State

### File Sizes
- `script.js`: **1,641 lines** (too large!)
- Contains: app logic, dialogs, utilities, toast, loading states

### Code Distribution
- Dialog builders: ~547 lines (4 major dialogs)
- Unused code: ~100 lines (welcome screen)
- Duplicate code: ~7 lines (duplicate toast)
- Core app logic: ~900 lines
- Utilities: ~87 lines

## 🗂️ Proposed Module Structure

```
public/
├── script.js              (~700 lines) - Main app logic
├── sessionApi.js          (100 lines) - Already done ✓
├── dialogs.js             (~500 lines) - NEW: All dialog builders
├── ui-utils.js            (~100 lines) - NEW: Toast, loading, formatters
└── sessionPicker.js       (existing)
```

---

## 📦 Module 1: `ui-utils.js` (~100 lines)

**Purpose:** Shared UI utilities used across the app

**Exports:**
```javascript
{
  toast(msg, options),
  showLoading(message),
  hideLoading(),
  formatTimestamp(timestamp),
  formatDate(date, locale),
  lockScrollBar(),
  unlockScrollBar()
}
```

**Functions to Extract:**
- `toast()` - Line 65-91 (27 lines) ✓ Keep the full version
- DELETE duplicate `toast()` at line 1084
- `showLoading()` - Line 96-107 (12 lines)
- `hideLoading()` - Line 108-113 (6 lines)
- `formatTimestamp()` - Line 1108-1122 (15 lines)
- NEW: `lockScrollBar()` - Extract common pattern
- NEW: `unlockScrollBar()` - Extract common pattern

**Benefits:**
- ✅ Eliminates duplicate toast function
- ✅ Centralizes all UI feedback mechanisms
- ✅ Reusable across all dialogs and main app

---

## 📦 Module 2: `dialogs.js` (~500 lines)

**Purpose:** All modal/overlay dialog builders

**Exports:**
```javascript
{
  showCreateSessionDialog(options),
  showSessionGate(options),
  showAdminSessionsPanel(sessions, adminKey),
  openShareLinksDialog(links),
  openCreateServerSessionDialog(adminKey),
  showDeleteConfirmDialog(session, onConfirm)
}
```

**Functions to Extract:**

### 1. `showCreateSessionDialog()` - Lines 805-894 (~90 lines)
**Dependencies:**
- `window.SessionApi.createCapabilitySession()`
- `ui-utils.toast()`
- `ui-utils.showLoading()`
- `ui-utils.hideLoading()`
- `openShareLinksDialog()` (internal)

**Parameters:**
```javascript
{
  onSuccess?: (result) => void,
  onError?: (error) => void
}
```

### 2. `showSessionGate()` - Lines 896-1083 (~187 lines)
**Dependencies:**
- `showAdminSessionsPanel()` (internal)
- `showCreateSessionDialog()` (internal)
- Checks `?admin=1` in URL

**Parameters:**
```javascript
{
  isAdminMode: boolean
}
```

### 3. `showAdminSessionsPanel()` - Lines 1124-1256 (~132 lines)
**Dependencies:**
- `window.SessionApi.deleteAdminSession()`
- `window.SessionApi.fetchAdminSessions()`
- `ui-utils.toast()`
- `ui-utils.formatTimestamp()`

**Parameters:**
```javascript
sessions: Array<Session>,
adminKey: string
```

### 4. `openShareLinksDialog()` - Lines 1257-1382 (~126 lines)
**Dependencies:**
- `ui-utils.toast()`
- Clipboard API

**Parameters:**
```javascript
links: {
  edit: string,
  view: string
}
```

### 5. `openCreateServerSessionDialog()` - Lines 1384-1495+ (~111 lines)
**Dependencies:**
- `window.SessionApi.createCapabilitySession()`
- `ui-utils.toast()`
- `openShareLinksDialog()` (internal)

**Parameters:**
```javascript
adminKey: string
```

---

## 🗑️ Code to Delete (~107 lines)

### Unused Functions (Dead Code)
1. ✅ **DELETE** `hasSeenWelcome()` - Line 704-710 (~7 lines)
2. ✅ **DELETE** `showWelcomeScreen()` - Line 711-803 (~93 lines)

### Duplicates
3. ✅ **DELETE** Duplicate `toast()` - Line 1084-1090 (~7 lines)

**Total Savings:** ~107 lines

---

## 🔧 Implementation Steps

### Phase 1: Quick Wins (Remove Dead Code)
**Effort:** 30 minutes
**Impact:** -107 lines

1. ✅ Delete `hasSeenWelcome()` function
2. ✅ Delete `showWelcomeScreen()` function
3. ✅ Delete duplicate `toast()` at line 1084
4. ✅ Remove any calls to deleted functions
5. ✅ Test that app still works
6. ✅ Commit: "refactor: remove unused welcome screen code"

**Result:** `script.js` goes from 1,641 → 1,534 lines

---

### Phase 2: Extract UI Utilities
**Effort:** 1-2 hours
**Impact:** Extract ~100 lines, reduce duplication

#### Step 2.1: Create `ui-utils.js`
```javascript
// public/ui-utils.js
(function(global) {
  'use strict';

  // Toast notification system
  function toast(msg, options = {}) {
    // ... existing implementation from line 65-91
  }

  // Loading overlay
  let loadingOverlay = null;
  function showLoading(message = 'Loading...') {
    // ... existing implementation from line 96-107
  }

  function hideLoading() {
    // ... existing implementation from line 108-113
  }

  // Timestamp formatter
  function formatTimestamp(timestamp) {
    // ... existing implementation from line 1108-1122
  }

  // Scroll lock utilities
  function lockScrollBar() {
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
    return {
      restore: () => unlockScrollBar()
    };
  }

  function unlockScrollBar() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
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

  if (global) {
    global.UIUtils = utils;
  }

  if (typeof module !== 'undefined') {
    module.exports = utils;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

#### Step 2.2: Update `public/index.html`
```html
<!-- Add before script.js -->
<script src="ui-utils.js"></script>
```

#### Step 2.3: Update `script.js`
Replace all occurrences:
- `toast(...)` → `UIUtils.toast(...)`
- `showLoading(...)` → `UIUtils.showLoading(...)`
- `hideLoading()` → `UIUtils.hideLoading()`
- `formatTimestamp(...)` → `UIUtils.formatTimestamp(...)`

Remove extracted functions from script.js.

#### Step 2.4: Update Tests
```javascript
// In test files, require the new module
const UIUtils = require('../public/ui-utils');
```

#### Step 2.5: Test & Commit
```bash
npm test
git add public/ui-utils.js public/index.html public/script.js
git commit -m "refactor: extract UI utilities to separate module"
```

**Result:** `script.js` goes from 1,534 → ~1,440 lines

---

### Phase 3: Extract Dialog Builders
**Effort:** 3-4 hours
**Impact:** Extract ~500 lines, improve organization

#### Step 3.1: Create `dialogs.js`

```javascript
// public/dialogs.js
(function(global) {
  'use strict';

  // Helper to get UIUtils (for toast, loading, etc)
  function getUtils() {
    return (global && global.UIUtils) || {
      toast: () => {},
      showLoading: () => {},
      hideLoading: () => {},
      formatTimestamp: () => 'N/A',
      lockScrollBar: () => ({ restore: () => {} }),
      unlockScrollBar: () => {}
    };
  }

  // Helper to get SessionApi
  function getApi() {
    return (global && global.SessionApi) || {};
  }

  // 1. Create Session Dialog
  function showCreateSessionDialog(options = {}) {
    // ... existing implementation from line 805-894
    // Use getUtils().toast(), getUtils().showLoading(), etc.
  }

  // 2. Session Gate (entry point for admin/regular users)
  function showSessionGate(options = {}) {
    // ... existing implementation from line 896-1083
  }

  // 3. Admin Sessions Panel
  function showAdminSessionsPanel(sessions, adminKey) {
    // ... existing implementation from line 1124-1256
    // Use getUtils().formatTimestamp()
  }

  // 4. Share Links Dialog
  function openShareLinksDialog(links) {
    // ... existing implementation from line 1257-1382
    // Use getUtils().toast()
  }

  // 5. Create Server Session Dialog
  function openCreateServerSessionDialog(adminKey) {
    // ... existing implementation from line 1384-1495+
  }

  // Export
  const dialogs = {
    showCreateSessionDialog,
    showSessionGate,
    showAdminSessionsPanel,
    openShareLinksDialog,
    openCreateServerSessionDialog
  };

  if (global) {
    global.Dialogs = dialogs;
  }

  if (typeof module !== 'undefined') {
    module.exports = dialogs;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

#### Step 3.2: Update `public/index.html`
```html
<!-- Add after ui-utils.js, before script.js -->
<script src="dialogs.js"></script>
```

#### Step 3.3: Update `script.js`
Replace all calls:
- `showCreateSessionDialog()` → `Dialogs.showCreateSessionDialog()`
- `showSessionGate()` → `Dialogs.showSessionGate()`
- `openShareLinksDialog(links)` → `Dialogs.openShareLinksDialog(links)`
- etc.

Remove all extracted dialog functions from script.js.

#### Step 3.4: Update Tests
```javascript
// In test files
const Dialogs = require('../public/dialogs');

// Mock dependencies
global.UIUtils = {
  toast: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  formatTimestamp: jest.fn(() => '5m ago'),
  lockScrollBar: jest.fn(() => ({ restore: jest.fn() })),
  unlockScrollBar: jest.fn()
};

global.SessionApi = {
  createCapabilitySession: jest.fn(),
  fetchAdminSessions: jest.fn(),
  deleteAdminSession: jest.fn()
};
```

#### Step 3.5: Create New Test File
```javascript
// __tests__/dialogs.test.js
describe('Dialogs module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  test('showCreateSessionDialog renders dialog', () => {
    Dialogs.showCreateSessionDialog();
    const overlay = document.getElementById('createSessionOverlay');
    expect(overlay).toBeTruthy();
  });

  test('openShareLinksDialog displays links', () => {
    const links = { edit: 'https://example.com/edit', view: 'https://example.com/view' };
    Dialogs.openShareLinksDialog(links);
    const editInput = document.getElementById('shareEditInput');
    expect(editInput.value).toBe(links.edit);
  });

  // ... more tests
});
```

#### Step 3.6: Test & Commit
```bash
npm test
git add public/dialogs.js public/index.html public/script.js __tests__/dialogs.test.js
git commit -m "refactor: extract dialog builders to separate module"
```

**Result:** `script.js` goes from 1,440 → ~700 lines! 🎉

---

## 📈 Final Results

| File | Before | After | Change |
|------|--------|-------|--------|
| `script.js` | 1,641 lines | ~700 lines | **-941 lines** ✅ |
| `ui-utils.js` | 0 lines | ~100 lines | +100 lines |
| `dialogs.js` | 0 lines | ~500 lines | +500 lines |
| **Total Production Code** | 1,641 lines | 1,300 lines | **-341 lines** ✅ |

### Benefits
- ✅ **57% reduction** in script.js size
- ✅ **Removed 107 lines** of dead code
- ✅ **Better separation** of concerns
- ✅ **Easier testing** (each module testable independently)
- ✅ **Reusable** UI utilities and dialogs
- ✅ **Improved maintainability**

---

## 🧪 Testing Strategy

### Unit Tests
1. **ui-utils.test.js** - Test toast, loading, formatting functions
2. **dialogs.test.js** - Test each dialog builder
3. Update existing **script.test.js** to use new modules

### Integration Tests
1. Test dialog interactions (create → share links → navigate)
2. Test admin flow (gate → auth → panel → delete)
3. Test error handling (API failures, invalid inputs)

### Manual Testing Checklist
- [ ] Create new session (regular user)
- [ ] Create session (admin mode)
- [ ] Share links dialog shows and copies correctly
- [ ] Admin panel loads and displays sessions
- [ ] Delete session confirmation works
- [ ] Loading states appear correctly
- [ ] Toast notifications work
- [ ] All dialogs have proper keyboard navigation

---

## 🚀 Deployment Plan

### Option A: Single PR (Recommended for review)
```bash
# Create feature branch
git checkout -b refactor/extract-dialog-modules

# Phase 1: Remove dead code
git commit -m "refactor: remove unused welcome screen code"

# Phase 2: Extract UI utilities
git commit -m "refactor: extract UI utilities to separate module"

# Phase 3: Extract dialogs
git commit -m "refactor: extract dialog builders to separate module"

# Push and create PR
git push origin refactor/extract-dialog-modules
gh pr create --title "Refactor: Extract dialogs and utilities into separate modules" \
  --body "Reduces script.js from 1,641 to ~700 lines by extracting reusable modules"
```

### Option B: Multiple PRs (Safer, incremental)
1. **PR #1:** Phase 1 only (remove dead code)
2. **PR #2:** Phase 2 (extract ui-utils.js)
3. **PR #3:** Phase 3 (extract dialogs.js)

---

## ⏱️ Time Estimate

- **Phase 1 (Dead Code):** 30 minutes
- **Phase 2 (UI Utils):** 1-2 hours
- **Phase 3 (Dialogs):** 3-4 hours
- **Testing:** 1-2 hours

**Total:** ~6-9 hours of focused work

---

## 📝 Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Comprehensive test coverage before refactoring |
| Test failures | Medium | Update tests incrementally with each phase |
| Global scope pollution | Low | Use IIFE pattern with proper exports |
| Circular dependencies | Low | Clear dependency hierarchy (utils → dialogs → script) |

---

## ✅ Success Criteria

- [x] script.js reduced to ~700 lines
- [x] All tests pass
- [x] No functionality broken
- [x] New modules properly exported
- [x] Test coverage maintained or improved
- [x] Code review approved
- [x] Documentation updated

---

## 📚 Follow-up Opportunities

After this refactoring:
1. Consider extracting more utilities from sessionPicker.js
2. Add JSDoc comments to all exported functions
3. Create TypeScript definitions for better IDE support
4. Add Storybook for dialog component documentation
5. Consider using a proper dialog library (e.g., headlessui)

---

**Ready to implement?** Start with Phase 1 (30 minutes) and see immediate results!
