# lazyWrite - Electron React Boilerplate

This project is set up using the `electron-react-boilerplate` and includes custom modifications for inter-process communication (IPC) between the main (backend) and renderer (frontend) processes.

## Duplicating the Setup

Follow these steps to set up and run this project:

### 1. Clone the Electron React Boilerplate

First, clone the `electron-react-boilerplate` directly into your desired project directory.

```bash
git clone https://github.com/electron-react-boilerplate/electron-react-boilerplate.git .
```

### 2. Rename the Main Process Folder

For better maintainability and clarity, the `src/main` folder (which contains the Electron main process code) has been renamed to `src/backend`.

```bash
mv src/main src/backend
```

### 3. Update Webpack Paths

After renaming the folder, you need to update the webpack configuration to reflect the new path.

Edit the file `.erb/configs/webpack.paths.ts` and change the `srcMainPath` definition.

**Old content (in `.erb/configs/webpack.paths.ts`):**
```typescript
const srcMainPath = path.join(srcPath, 'main');
```

**New content (in `.erb/configs/webpack.paths.ts`):**
```typescript
const srcMainPath = path.join(srcPath, 'backend');
```

### 4. Install Dependencies

Navigate into the project directory and install all necessary dependencies using npm.

```bash
npm install
```

### 5. Implement IPC Message Handler (Backend)

Create a new file `src/backend/ipc/messageHandler.ts` to encapsulate the IPC logic for handling messages from the renderer process.

**File: `src/backend/ipc/messageHandler.ts`**
```typescript
import { ipcMain } from 'electron';

export function registerMessageHandlers() {
  ipcMain.on('display-message', async (event, message: string) => {
    console.log('Message from renderer:', message);
    event.reply('display-message-response', `Main process received: "${message}"`);
  });
}
```

### 6. Integrate Message Handler into Main Process

Update `src/backend/main.ts` to import and call the `registerMessageHandlers` function.

**Edit `src/backend/main.ts`:**

Find the following block (or similar, depending on boilerplate updates):
```typescript
ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});
```

Replace it with (or add the `registerMessageHandlers()` call after it):
```typescript
ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

registerMessageHandlers();
```
Also, ensure you have the import for `registerMessageHandlers` at the top of `src/backend/main.ts`:
```typescript
import { registerMessageHandlers } from './ipc/messageHandler';
```

### 7. Update Preload Script Channels

Modify `src/backend/preload.ts` to include the new IPC channel names in the `Channels` type definition.

**Edit `src/backend/preload.ts`:**

Find the line:
```typescript
export type Channels = 'ipc-example';
```

Replace it with:
```typescript
export type Channels = 'ipc-example' | 'display-message' | 'display-message-response';
```

### 8. Implement Message Sending and Display (Frontend)

Update `src/renderer/App.tsx` to include a button for sending messages to the main process and to display the response.

**Edit `src/renderer/App.tsx`:**

Add the following imports at the top:
```typescript
import { useState, useEffect } from 'react';
```

Modify the `Hello` functional component to include state, a `useEffect` hook for listening to IPC responses, and a button to send messages:

**Old `Hello` component (or similar):**
```typescript
function Hello() {
  return (
    <div>
      <div className="Hello">
        <img width="200" alt="icon" src={icon} />
      </div>
      <h1>electron-react-boilerplate</h1>
      <div className="Hello">
        <a
          href="https://electron-react-boilerplate.js.org/"
          target="_blank"
          rel="noreferrer"
        >
          <button type="button">
            <span role="img" aria-label="books">
              📚
            </span>
            Read our docs
          </button>
        </a>
        <a
          href="https://github.com/sponsors/electron-react-boilerplate"
          target="_blank"
          rel="noreferrer"
        >
          <button type="button">
            <span role="img" aria-label="folded hands">
              🙏
            </span>
            Donate
          </button>
        </a>
      </div>
    </div>
  );
}
```

**New `Hello` component:**
```typescript
function Hello() {
  const [messageResponse, setMessageResponse] = useState<string | null>(null);

  useEffect(() => {
    window.electron.ipcRenderer.on('display-message-response', (arg) => {
      setMessageResponse(arg as string);
    });
    return () => {
      window.electron.ipcRenderer.removeListener('display-message-response', () => {});
    };
  }, []);

  const sendMessageToMain = () => {
    window.electron.ipcRenderer.sendMessage('display-message', 'Hello from the renderer process!');
  };

  return (
    <div>
      <div className="Hello">
        <img width="200" alt="icon" src={icon} />
      </div>
      <h1>electron-react-boilerplate</h1>
      <div className="Hello">
        <a
          href="https://electron-react-boilerplate.js.org/"
          target="_blank"
          rel="noreferrer"
        >
          <button type="button">
            <span role="img" aria-label="books">
              📚
            </span>
            Read our docs
          </button>
        </a>
        <a
          href="https://github.com/sponsors/electron-react-boilerplate"
          target="_blank"
          rel="noreferrer"
        >
          <button type="button">
            <span role="img" aria-label="folded hands">
              🙏
            </span>
            Donate
          </button>
        </a>
        <button type="button" onClick={sendMessageToMain}>
          Send Message to Main
        </button>
      </div>
      {messageResponse && (
        <p style={{ marginTop: '20px', color: 'green' }}>
          Response from Main: {messageResponse}
        </p>
      )}
    </div>
  );
}
```

### 9. Run the Application

You can now start the Electron application in development mode:

```bash
npm start
```

Click the "Send Message to Main" button in the application window to test the IPC communication. You should see the response displayed in the app and logged in your terminal.