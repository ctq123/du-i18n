import * as vscode from 'vscode';
import { Message, MessageType } from './message';
import { Utils } from './index';

const fs = require('fs');
const path = require('path');
const isEmpty = require('lodash/isEmpty');
const isObject = require('lodash/isObject');

/**
 * 文件IO操作
 */
export class FileIO {
  /**
   * 读取文件
   * @param includePaths
   * @returns
   */
  static async getFiles(includePaths: string) {
    const pattern = /[{}]/; // 正则表达式
    let newIncludePaths = includePaths;
    if (!pattern.test(includePaths)) {
      // 判断是否包含{}
      newIncludePaths = `{${includePaths}}`;
    }

    const files = await vscode.workspace.findFiles(
      `${newIncludePaths}`,
      `{**/node_modules/**, **/.git/**, **/@types/**, **/.vscode/**, **.d.ts, **/.history/**}`
    );
    return files;
  }

  /**
   * 递归创建文件夹
   * @param dirPaths 
   */
  static mkdirs(dirPaths: string) {
    if (!fs.existsSync(path.dirname(dirPaths))) {
      FileIO.mkdirs(path.dirname(dirPaths));
    }
    fs.mkdirSync(dirPaths);
  }

  /**
   * 获取base路径
   * @param curFilePath 当前文件路径
   * @param filePaths 要查找的文件
   * @returns
   */
  static async getBasePath(curFilePath: string, filePaths: string) {
    const files = await FileIO.getFiles(filePaths);

    if (files.length === 0) {
      return '';
    }

    const newFiles = files.filter((file: any) => {
      const currentPath = path.dirname(file.fsPath);
      return FileIO.isIncludePath(curFilePath, currentPath);
    });

    if (newFiles.length === 0) {
      return '';
    }

    // 离当前文件最近的文件夹
    const closestBasePath = newFiles.reduce((pre, { fsPath }) => {
      const currentPath = path.dirname(fsPath);
      const currentDepth = currentPath.split(path.sep).length;
      const closestDepth = pre.split(path.sep).length;
      return currentDepth > closestDepth ? currentPath : pre;
    }, path.dirname(newFiles[0].fsPath));

    return closestBasePath;
  }

  /**
   * 获取base路径
   * @param curFilePath 当前文件路径
   * @param fileName 拼接的文件
   * @param filePaths 要查找的文件，默认package.json
   * @returns
   */
  static async getBaseFilePath(
    curFilePath: string,
    fileName: string,
    filePaths: string = '**/package.json'
  ) {
    const basePath = await FileIO.getBasePath(curFilePath, filePaths);
    return path.join(basePath, fileName);
  }

  /**
   * 将内容写入本地文件
   * @param basePath
   * @param fileName
   * @param conentObj
   * @returns
   */
  static async writeContentToLocalFile(
    basePath: any,
    fileName: any,
    conentObj: any
  ) {
    let newText = conentObj;
    if (isObject(conentObj)) {
      newText = JSON.stringify(conentObj, null, '\t');
    }
    const filePath = await FileIO.createFile(basePath, fileName, newText);
    // console.log("filePath", filePath);
    return filePath;
  }

  /**
   * 写入本地文件
   * @param basePath
   * @param fileName
   * @param conentObj
   * @returns
   */
  static async writeContentToLocalFile2(
    basePath: any,
    fileName: any,
    conentObj: any
  ) {
    let newText = conentObj;
    if (isObject(conentObj)) {
      newText = JSON.stringify(conentObj, null, '\t');
    }
    const filePath = await FileIO.createDirFile(basePath, fileName, newText);
    // console.log("filePath", filePath);
    return filePath;
  }

  /**
   * 创建文件
   * @param basePath
   * @param fileName
   * @param content
   * @returns
   */
  static async createFile(
    basePath: string,
    fileName: string,
    content: any = ''
  ) {
    let newFilePath = await FileIO.getBaseFilePath(basePath, fileName);
    // console.log('newFilePath', newFilePath, newText)
    if (newFilePath) {
      FileIO.writeFileToLine(newFilePath, content);
    }
    return newFilePath;
  }

  /**
   * 创建文件
   * @param basePath
   * @param fileName
   * @param content
   * @returns
   */
  static async createDirFile(
    basePath: string,
    fileName: string,
    content: any = ''
  ) {
    fs.mkdirSync(basePath, { recursive: true });
    const newFilePath = path.join(basePath, fileName);
    // console.log('newFilePath', newFilePath, newText)
    if (newFilePath) {
      FileIO.writeFileToLine(newFilePath, content);
    }
    return newFilePath;
  }
  /**
   * 同步写入文件
   * @param filePath
   * @param str
   * @returns
   */
  static async writeFileToLine(filePath: string, str: string) {
    try {
      fs.writeFileSync(filePath, str);
      return true;
    } catch (e) {
      console.error('writeFileToLine e', e);
      return false;
    }
  }

  /**
   * 路径是否属于包含关系
   * @param parentPath
   * @param childPath
   * @returns
   */
  static isIncludePath(parentPath: string, childPath: string) {
    const parentDirs = parentPath?.replace(/\//g, path.sep);
    const childDirs = childPath?.replace(/\//g, path.sep);

    return parentDirs?.includes(childDirs);
  }

  /**
   * 读取文件
   * @param uri
   * @returns
   */
  static readFile(uri: vscode.Uri) {
    return new Promise<Uint8Array | null>((resolve, reject) => {
      vscode.workspace.fs.readFile(uri).then(
        (fileContent) => {
          resolve(fileContent);
        },
        (reason) => {
          Message.showMessage(
            `读取文件失败-${uri.fsPath}: ${reason}`,
            MessageType.ERROR
          );
          // vscode.window.showErrorMessage(`读取文件失败-${uri.fsPath}: ${reason}`);
          reject();
        }
      );
    });
  }

  /**
   * 获取文件夹下所有文件
   * @param folderPath
   * @param isUri 是否是uri
   * @returns
   */
  static getFolderFiles(folderPath: string, isUri: boolean = false) {
    return new Promise((resolve, reject) => {
      if (!folderPath) {
        reject('文件夹路径不能为空');
        return;
      }

      fs.readdir(folderPath, (err, files) => {
        if (err) {
          return reject(err.message);
        }
        const fileUris: vscode.Uri[] = [];
        const filePaths: string[] = [];
        // 创建一组 promise 用于处理递归读取
        const promises = files.map((file) => {
          const filePath = path.join(folderPath, file);

          return new Promise<void>((resolve, reject) => {
            fs.stat(filePath, (err, stats) => {
              if (err) {
                console.error('stat error', err);
                return reject(err);
              }

              if (stats.isDirectory()) {
                // 如果是目录，递归读取
                FileIO.getFolderFiles(filePath)
                  .then((subFileUris: any[]) => {
                    if (isUri) {
                      fileUris.push(...subFileUris);
                    } else {
                      filePaths.push(...subFileUris);
                    }
                    resolve();
                  })
                  .catch(reject);
              } else {
                if (isUri) {
                  // 如果是文件，转换为 vscode.Uri
                  fileUris.push(vscode.Uri.file(filePath));
                } else {
                  filePaths.push(filePath);
                }
                resolve();
              }
            });
          });
        });

        // 等待所有 promise 完成
        Promise.all(promises)
          .then(() => {
            if (isUri) {
              resolve(fileUris);
            } else {
              resolve(filePaths);
            }
          })
          .catch(reject);
      });
    });
  }

  /**
   * 写入流文件
   * @param filePath 
   * @param data 
   * @param callback 
   */
  static handleWriteStream(filePath: string, data: string, callback: Function) {
    // 创建一个可以写入的流，写入到文件中
    let writerStream = fs.createWriteStream(filePath);
  
    // 使用 utf8 编码写入数据
    writerStream.write(data, 'UTF8');
  
    // 标记文件末尾
    writerStream.end();
  
    // 处理流事件 --> finish、error
    writerStream.on('finish', function() {
        // console.log("写入完成。");
        callback();
    });
  
    writerStream.on('error', function(err){
      console.log(err.stack);
    });
  } 

  /**
   * 读取流文件
   * @param filePath 
   * @param callback 
   */
  static handleReadStream(filePath: string, callback: Function) {
    let data = '';

    // 创建可读流
    let readerStream = fs.createReadStream(filePath);

    // 设置编码为 utf8。
    readerStream.setEncoding('UTF8');

    // 处理流事件 --> data, end, and error
    readerStream.on('data', function(chunk) {
      data += chunk;
    });

    readerStream.on('end',function(){
      // console.log(data);
      callback(data);
    });

    readerStream.on('error', function(err){
      console.log(err.stack);
    });
  }

  /**
   * 同步写入json文件
   * @param filePath 
   * @param text 
   * @returns 
   */
  static writeJsonFileSync(filePath: string, text: string) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const index = data.lastIndexOf('}');
      if (index > -1) {
        // 判断前面是否需要添加逗号
        const lastComma = data.lastIndexOf(',', index);
        let content = '';
        if (lastComma > -1) {
          const s = data.substring(lastComma + 1, index);
          content = s.replace(/[\t\n\s]/g, '');
        }
        let newText = content ? `,${text}` : text;
        let arr = (newText || '').split('\n');
        newText = arr.map((c, i) => i < arr.length - 1 ? ('\t' + c) : c).join('\n');
        const newStr= data.slice(0, index) + newText + data.slice(index);
        return FileIO.writeFileToLine(filePath, newStr);
      }
      return false;
    } catch(e) {
      console.error("writeJsonFileSync e", e);
      return false;
    }
  }

  /**
   * 写入临时文件
   * @param tempPaths 
   * @param filePath 
   * @param newLangObj 
   * @param pageEnName 
   * @param tempFileName 
   * @param isNeedRandSuffix 
   * @param cb 
   */
  static async writeIntoTempFile(tempPaths: string, filePath: string, newLangObj: any, pageEnName: string, tempFileName: string, isNeedRandSuffix: boolean, cb: Function) {
    try {
      let newPath = await FileIO.getBaseFilePath(filePath, tempPaths);
      newPath = newPath.replace(/\*/g, '');
      if (!fs.existsSync(newPath)) {
        FileIO.mkdirs(newPath);
      }
      console.log('newPath', newPath);
      let randFileName = '';
      let newFilePath = '';
      let content = '';
      if (tempFileName && /\.(json)$/.test(tempFileName)) {
        randFileName = tempFileName;
        newFilePath = path.join(newPath, randFileName);
        try {
          const data = fs.readFileSync(newFilePath, 'utf-8');
          if (data) {
            const oldLangObj = eval(`(${data})`);
            const langObj = {
              ...oldLangObj
            };
            if (!isEmpty(newLangObj)) {
              Object.entries(newLangObj).forEach(([lang, obj]) => {
                if (!langObj[lang]) {
                  langObj[lang] = {};
                }
                const newObj: any = obj || {};
                langObj[lang] = {
                  ...langObj[lang],
                  ...newObj,
                };
              });
            }
            content = JSON.stringify(langObj, null, '\t');
          }
        } catch(e) {}
      } else {
        if (isNeedRandSuffix) {
          // 随机生成文件名
          randFileName = Utils.getRandFileName(pageEnName, '.json');
        } else {
          randFileName = pageEnName + '.json';
        }
        // 拼接文件路径
        newFilePath = path.join(newPath, randFileName);
      }
      if (!content) {
        content = JSON.stringify(newLangObj, null, '\t');
      }
      if (FileIO.writeFileToLine(newFilePath, content)) {
        cb(newFilePath, newLangObj);
      };
    } catch (e) {
      console.error(e);
    }
  };
  
  /**
   * 合并语言文件
   * @param langPaths 
   * @param filePath 
   * @param langFileName 
   * @param localLangObj 
   * @param cb 
   */
  static async  generateMergeLangFile(langPaths: string, filePath: string, langFileName: string, localLangObj: any, cb: Function) {
    try {
      let newPath = await FileIO.getBaseFilePath(filePath, langPaths);
      newPath = newPath.replace(/\*/g, '');
      if (!fs.existsSync(newPath)) {
        FileIO.mkdirs(newPath);
      }
      console.log('newPath', newPath);
      // console.log('localLangObj', localLangObj);
      if (!isEmpty(localLangObj)) {
        const newFilePath = path.join(newPath, langFileName);
        const content = JSON.stringify(localLangObj, null, '\t');
        FileIO.writeFileToLine(newFilePath, content);
      }
      cb(newPath);
    } catch (e) {
      console.error(e);
    }
  };
  
  /**
   * 拆分语言文件
   * @param langPaths 
   * @param filePath 
   * @param localLangObj 
   * @param cb 
   */
  static async generateSplitLangFile(langPaths: string, filePath: string, localLangObj: any, cb: Function) {
    try {
      let newPath = await FileIO.getBaseFilePath(filePath, langPaths);
      newPath = newPath.replace(/\*/g, '');
      if (!fs.existsSync(newPath)) {
        FileIO.mkdirs(newPath);
      }
      console.log('newPath', newPath);
      // console.log('localLangObj', localLangObj);
      if (!isEmpty(localLangObj)) {
        Object.entries(localLangObj).forEach(([lang, obj]) => {
          const langFileName = lang + '.json';
          const newFilePath = path.join(newPath, langFileName);
          const content = JSON.stringify(obj, null, '\t');
          FileIO.writeFileToLine(newFilePath, content);
        });
      }
      cb(newPath);
    } catch (e) {
      console.error(e);
    }
  };
}
