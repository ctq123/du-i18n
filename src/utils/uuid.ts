import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

const uuidKey = 'uuidKey';
export class Uuid {
  static getUuid(context: vscode.ExtensionContext) {
    return context.globalState.get(uuidKey);
  }
  static setUuid(context: vscode.ExtensionContext) {
    const uuid = context.globalState.get(uuidKey);
    if (!uuid) {
      context.globalState.update(uuidKey, uuidv4());
    }
  }
}