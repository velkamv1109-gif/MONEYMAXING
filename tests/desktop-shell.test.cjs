const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMainWindow } = require('../main.cjs');

function createFakeWindowClass() {
  return class FakeWindow {
    static instances = [];
    constructor(options) {
      this.options = options;
      this.openHandler = null;
      this.navigationHandler = null;
      this.loadedURL = null;
      this.webContents = {
        on: (event, handler) => {
          if (event === 'will-navigate') this.navigationHandler = handler;
        },
        setWindowOpenHandler: handler => { this.openHandler = handler; }
      };
      this.setMenuBarVisibility = visible => { this.menuBarVisible = visible; };
      this.loadURL = async url => { this.loadedURL = url; };
      FakeWindow.instances.push(this);
    }
  };
}

test('creates a secure standalone window and loads the packaged app', async () => {
  const BrowserWindow = createFakeWindowClass();
  const origin = 'http://127.0.0.1:4765';
  const win = await createMainWindow({ BrowserWindow, origin });

  assert.equal(win.options.title, 'MONEYMAXING');
  assert.equal(win.options.width, 1280);
  assert.equal(win.options.webPreferences.nodeIntegration, false);
  assert.equal(win.options.webPreferences.contextIsolation, true);
  assert.equal(win.options.webPreferences.sandbox, true);
  assert.equal(win.loadedURL, origin);
  assert.equal(win.menuBarVisible, false);
});

test('blocks popups and page navigation from the local application', async () => {
  const BrowserWindow = createFakeWindowClass();
  const win = await createMainWindow({ BrowserWindow, origin: 'http://127.0.0.1:4765' });
  let prevented = false;

  win.navigationHandler({ preventDefault() { prevented = true; } });

  assert.equal(prevented, true);
  assert.deepEqual(win.openHandler(), { action: 'deny' });
});
