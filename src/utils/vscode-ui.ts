import * as vscode from 'vscode';
import { Utils } from './index';
import { Config } from './config';
import { FileIO } from './fileIO';
const path = require('path');
const isEmpty = require('lodash/isEmpty');

let timeoutId = null;
let decorationType = null;
/**
 * vscode-UI交互类
 */
export class VSCodeUI {
  static userKey = '';
  /**
   * 渲染装饰类
   * @param config
   */
  static renderDecoration(config: Config) {
    const activeEditor = vscode.window.activeTextEditor;
    // console.log("lang", lang)
    const langObj = config.getCurLangObj(VSCodeUI.userKey);
    if (activeEditor && !isEmpty(langObj)) {
      // console.log('langObj', langObj);
      const { fileName, getText } = activeEditor.document || {};
      const contentText = getText ? getText() : '';
      const quoteKeysStr = config.getQuoteKeysStr();
      const fileReg = config.getFileReg();
      // 判断当前文档是否包含i18n的引用
      if (quoteKeysStr && fileReg.test(fileName) && VSCodeUI.checkText(contentText, quoteKeysStr)) {
        const positionObj = VSCodeUI.getKeyPosition(contentText, quoteKeysStr);
        console.log("positionObj", positionObj);
        VSCodeUI.triggerUpdateDecorations(activeEditor, positionObj, langObj);
      }
    }
  }

  /**
   * 获取i18n的key
   * @param keyStr 
   * @returns 
   */
  static getI18NKey(keyStr: string) {
    let res = keyStr;
    res = res.split(',')[0];
    res = res.replace(/[\t\n'"]/g, '');
    return res;
  }

  /**
   * 判断当前文档是否包含i18n的引用
   * @param str 
   * @param keys 
   * @returns 
   */
  static checkText(str: string, keys: string) {
    const list = keys.replace(/\s/g, '').replace(',', '(,').split(',');
    return list.some(t => t !== '(' && str.indexOf(t) > -1);
  }

  static getKeyPosition(text: any, keys: string) {
    const positionObj: any = {};// key: 左括号位置+右括号位置，value: i18n的字符串
    if (keys && text) {
      keys.split(',').forEach((k) => {
        const key = (k || '').trim() + '(';
        let index = -1, startIndex = 0;
        while((index = text.indexOf(key, startIndex)) > -1) {
          const leftCol = index + key.length;// 左括号位置
          const rightCol = text.indexOf(')', leftCol);// 右括号位置
          if (rightCol > -1) {
            const value = VSCodeUI.getI18NKey(text.substring(leftCol, rightCol));
            // key: 左括号位置+右括号位置，value: i18n的字符串
            positionObj[`${leftCol}-${rightCol+1}`] = value;
            startIndex = leftCol;
          } else {
            break;
          }
        }
      });
    }
    return positionObj;
  }

  /**
   * 显示装饰
   * @param editor
   * @param positionObj
   * @param lang
   */
  static showDecoration(editor: vscode.TextEditor, positionObj: object, lang: object) {
    if (editor && positionObj) {
      const foregroundColor = new vscode.ThemeColor('editorCodeLens.foreground');
      
      // 坑：一定要先清空，否则会出现重复的情况，即使将全局变量decorationType改成局部变量也无效
      if (decorationType) {
        // 释放操作
        decorationType.dispose();
      }
  
      decorationType = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        overviewRulerColor: 'grey',
        overviewRulerLane: vscode.OverviewRulerLane.Left,
      });
      
      const decorationOptions: any = [];
      // console.log("positionObj", positionObj);
      Object.entries(positionObj).forEach(([k, v]: any) => {
        const p: any = k.split('-');
        if (p && p.length === 2) {
          const startPosition = editor.document.positionAt(p[0]);
          const endPosition = editor.document.positionAt(p[1]);
          const range = new vscode.Range(startPosition, endPosition);
          const value = Utils.getObjectValue(lang, v);
          const text = Utils.getStringText(value); 
          const item = {
            range,
            renderOptions: {
              after: {
                contentText: ` ${text}`,
                color: foregroundColor,
                opacity: '0.6',
              },
            }
          };
          decorationOptions.push(item);
        };
      });
      editor.setDecorations(decorationType, decorationOptions);
    }
  }

  /**
   * 触发更新装饰
   * @param activeEditor
   * @param positionList
   * @param langObj
   */
  static triggerUpdateDecorations(
    activeEditor: vscode.TextEditor,
    positionObj: object,
    langObj: object) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(
      () => VSCodeUI.showDecoration(activeEditor, positionObj, langObj),
      300
    );
  }
 

  /**
   * 写入并打开文档
   * @param basePath
   * @param dirName
   * @param fileName
   * @param content
   */
  static async writeAndOpenDoc(basePath, dirName, fileName, content) {
    const dirNameArr = dirName.split('/');
    const newFilePath = path.join(basePath, ...dirNameArr, fileName);
    await FileIO.writeContentToLocalFile2(
      path.join(basePath, ...dirNameArr),
      fileName,
      content
    );

    vscode.workspace.openTextDocument(newFilePath).then((doc) => {
      vscode.window.showTextDocument(doc);
    });
  }
}
