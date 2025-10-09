import { ChildProcessWithoutNullStreams } from 'child_process';
import { ipcMain } from 'electron';

export default function registerPythonMessageHandlers(
  pythonProcess: ChildProcessWithoutNullStreams,
) {
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python stdout: ${data}`);
    // You might want to send this data to the renderer process
    // mainWindow.webContents.send('python-stdout', data.toString());
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
    // You might want to send this error to the renderer process
    // mainWindow.webContents.send('python-stderr', data.toString());
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    // You might want to notify the renderer process about the exit
    // mainWindow.webContents.send('python-exit', code);
  });

  pythonProcess.on('error', (err) => {
    console.error(`Failed to start Python process: ${err}`);
    // You might want to notify the renderer process about the error
    // mainWindow.webContents.send('python-error', err.message);
  });

  // IPC handler for sending audio data to Python
  ipcMain.on('send-audio-to-python', (event, audioData) => {
    console.log('Main process received audio data from renderer.'); // New log
    if (pythonProcess) {
      console.log('Main process writing to Python stdin.'); // New log
      pythonProcess.stdin.write(`${JSON.stringify(audioData)}\n`);
    } else {
      console.error(`Python process not running.`);
    }
  });
}
