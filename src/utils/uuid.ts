import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

const uuidKey = 'uuidKey';
export function getUuid(context: vscode.ExtensionContext) {
  return context.globalState.get(uuidKey);
}
export function setUuid(context: vscode.ExtensionContext) {
  const uuid = context.globalState.get(uuidKey);
  if (!uuid) {
    context.globalState.update(uuidKey, uuidv4());
  }
}