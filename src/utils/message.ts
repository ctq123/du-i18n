import * as vscode from 'vscode';

export enum MessageType {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

export class Message {
  static showMessage(message: string, type: string = MessageType.INFO) {
    switch (type) {
      case MessageType.ERROR:
        vscode.window.showErrorMessage(message);
        break;
      case MessageType.WARNING:
        vscode.window.showWarningMessage(message);
        break;
      case MessageType.INFO:
        vscode.window.showInformationMessage(message);
        break;
    }
  }
}
