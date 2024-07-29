type VSCode = {
  postMessage<T extends any>(message: T): void;
  getState(): any;
  setState(state: any): void;
};

declare const vscode: VSCode;
