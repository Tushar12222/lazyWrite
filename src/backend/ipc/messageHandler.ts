import { ipcMain } from 'electron';

export function registerMessageHandlers() {
  ipcMain.on('display-message', async (event, message: string) => {
    console.log('Message from renderer:', message);
    event.reply(
      'display-message-response',
      `Main process received: "${message}"`,
    );
  });
}
