/** @jest-environment jsdom */

describe('SessionPicker admin mode button visibility', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
    // Mock window.location
    delete window.location;
    window.location = new URL('https://example.com/?admin=1');
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('hides Open Session button when admin=1 is in URL', () => {
    const SessionPicker = require('../public/sessionPicker');
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Render session picker with admin=1 in URL
    SessionPicker.render(container, {
      sessions: ['Test Session 1', 'Test Session 2'],
      onOpen: jest.fn(),
      onCreate: jest.fn()
    });

    const openBtn = document.getElementById('openSessionBtn');
    expect(openBtn).toBeTruthy();
    
    // The button should be hidden via display: none
    expect(openBtn.style.display).toBe('none');
  });

  test('shows Open Session button when admin=1 is NOT in URL', () => {
    // Reset to non-admin URL
    delete window.location;
    window.location = new URL('https://example.com/');

    const SessionPicker = require('../public/sessionPicker');
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Render session picker without admin=1 in URL
    SessionPicker.render(container, {
      sessions: ['Test Session 1', 'Test Session 2'],
      onOpen: jest.fn(),
      onCreate: jest.fn()
    });

    const openBtn = document.getElementById('openSessionBtn');
    expect(openBtn).toBeTruthy();
    
    // The button should NOT be hidden
    expect(openBtn.style.display).not.toBe('none');
  });

  test('shows admin mode banner when admin=1 is in URL', () => {
    const SessionPicker = require('../public/sessionPicker');
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Render session picker with admin=1 in URL
    SessionPicker.render(container, {
      sessions: ['Test Session 1'],
      onOpen: jest.fn(),
      onCreate: jest.fn()
    });

    // Check for admin banner
    const banner = container.querySelector('.bg-blue-50.border-l-4.border-blue-500');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Session Management Panel');
    expect(banner.textContent).toContain('You cannot "open" sessions from this panel');
  });

  test('clicking Open Session button shows error toast in admin mode (if button were visible)', () => {
    // Mock toast function
    window.toast = jest.fn();

    const SessionPicker = require('../public/sessionPicker');
    const container = document.createElement('div');
    document.body.appendChild(container);

    const onOpenCallback = jest.fn();
    SessionPicker.render(container, {
      sessions: ['Test Session'],
      onOpen: onOpenCallback,
      onCreate: jest.fn()
    });

    const openBtn = document.getElementById('openSessionBtn');
    const select = document.getElementById('sessionSelect');
    
    // The button is hidden, but we can still test the click handler by forcing it
    // Make button visible and enabled to test the handler
    openBtn.style.display = 'block';
    openBtn.disabled = false;
    
    // Select a session
    select.value = 'Test Session';
    select.dispatchEvent(new Event('change'));

    // Try to click the button
    openBtn.click();

    // Should show error toast, not call onOpen
    expect(window.toast).toHaveBeenCalledWith(
      expect.stringContaining('Sessions can only be accessed via their unique capability link'),
      expect.any(Object)
    );
    expect(onOpenCallback).not.toHaveBeenCalled();

    delete window.toast;
  });
});
