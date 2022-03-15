import * as vscode from 'vscode';
import { CortexDebugExtension } from './extension';
import { RegisterNode } from './views/nodes/registernode';

export function getRegisters() {
  return new Promise((resolve, reject) => {  
    const registers: RegisterNode[] = [];

    const session = CortexDebugExtension.getActiveCDSession();
    if (session) {
      session.customRequest('read-register-list').then((data) => {
        data.forEach((reg, idx) => {
          if (reg) {
            registers.push(reg);
          }
        });
        resolve(registers);
      }, (error) => {
        const msg = error.message || '';
        vscode.window.showErrorMessage(`Unable to read registers: ${msg}`);
        reject(error.toString());
      });
    } else {
      reject(new Error('RegisterContentProvider: unknown debug session type'));
    }
  });
}