import { ChildProcessWithoutNullStreams } from 'child_process';
import { ipcMain, BrowserWindow } from 'electron';

export default function registerPythonMessageHandlers(
  pythonProcess: ChildProcessWithoutNullStreams,
) {
  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });

  pythonProcess.on('error', (err) => {
    console.error(`Failed to start Python process: ${err}`);
  });

  // IPC handler for sending audio data to Python
  ipcMain.on('send-audio-to-python', (event, audioData) => {
    console.log('Main process received audio data from renderer.'); // New log
    if (pythonProcess) {
      console.log('Main process writing to Python stdin.'); // New log
      pythonProcess.stdin.write(`${JSON.stringify(audioData)}\n`);

      pythonProcess.stdout.on('data', (data) => {
        console.log(`Python stdout: ${data}`);
        event.reply('python-audio-response', data);
      });

    } else {
      console.error(`Python process not running.`);
    }
  });
}
