import * as vscode from 'vscode';
import MapCache from './cache';
import { Baidu } from './baidu';
import { FileIO } from './fileIO';
const path = require('path');
const fs = require('fs');
const YAML = require('yaml');
const merge = require('lodash/merge');
const isEmpty = require('lodash/isEmpty');
const isObject = require('lodash/isObject');

// 频繁调用，缓存计算结果
const RegCache = new MapCache();
const chineseCharReg = /[\u4e00-\u9fa5]/;
const chineseChar2Reg = /[\u4e00-\u9fa5]+|[\u4e00-\u9fa5]/g;
const varReg = /\$\{(.[^\}]+)?\}/g; // 判断包含${}的正则
let decorationType = null;
const globalPkgPath = '**/package.json';
const boundaryCodes = ['"', "'", "`"]; // 字符串边界

export class Utils {
  /**
   * 获取复制对象的value
   * 如{ "a.b": 1, a: { c: 2, d: [{e: 'e'}, {f: 'f'}] } }，获取obj, 'a.d.1.f'
   * @param obj 
   * @param key 
   * @returns 
   */
  static getObjectValue(obj: any, key: string) {
    if (Object.prototype.toString.call(obj) === '[object Object]') {
      if (Object(obj).hasOwnProperty(key)) {
        return obj[key];
      } else {
        if (key.indexOf('.')) {
          return key.split('.').reduce((pre, k) => Object(pre).hasOwnProperty(k) ? pre[k] : undefined, obj);
        }
      }
    }
    return undefined;
  }

  static getStringValue(val: any) {
    if (Object.prototype.toString.call(val) === '[object Object]' || Array.isArray(val)) {
      return JSON.stringify(val);
    }
    return val ? val.toString() : val;
  }

  static getRegExpStr(str: string) {
    if (str) {
      return str.replace(/([\.\(\)\$\*\+\[\?\]\{\}\|\^\\])/g, '\\$1');
    }
    return '';
  }

  static getRegExp(str: string) {
    if (!RegCache.get(str)) {
      let completionKeyStr = Utils.getRegExpStr(str);
      completionKeyStr = completionKeyStr.split(',').map(c => c.trim()).filter(Boolean).join('|');
      const reg = new RegExp(`([\\s{'"]+)(${completionKeyStr})([\\('"])?`);
      RegCache.set(str, reg);
    }
    return RegCache.get(str);
  }

  static getStringText(val: any) {
    if (Array.isArray(val) || Object.prototype.toString.call(val) === '[object Object]') {
      return JSON.stringify(val);
    }
    return val ? val.toString() : val;
  }

  static replaceText(data: string, template: string, newText: string) {
    if (!data) { return data; }
    const startIndex = data.indexOf(template) + template.length;
    const endIndex = data.indexOf(template, startIndex);
    return data.slice(0, startIndex) + newText + data.slice(endIndex);
  }

  static handleScanFileInner(data: string, filePath: string) {
    try {
      // 公司内部自定义的格式
      if (data && data.indexOf('</i18n>') > -1) {
        const i18nSrcReg = /<i18n\ssrc=+(([\s\S])*?)>(.*\s)?<\/i18n>/g;
        let yamlStr = '';
        let yamlObjList = [];
        let yamlObj = null;
        let urlPath = '';
        let langFilePath = {};
        let count = 0;
        let res = null;
        let startIndex = -1;
        let endIndex = 0;
        while ((startIndex = data.indexOf('<i18n>', endIndex)) > -1) {// 可能存在多个的情况
          endIndex = data.indexOf('</i18n>', startIndex);
          yamlStr = data.substring(startIndex + 6, endIndex);
          urlPath = filePath;
          yamlObjList.push(YAML.parse(yamlStr));
        }

        if (count > 0) {// <i18n>在外部文件
          if (count === 1) {// 所有语言在一个文件
            langFilePath = {};
          } else {// 所有语言在多个文件
            urlPath = '';
          }
        }

        // console.log("yamlObjList", yamlObjList);
        if (yamlObjList.length) {
          yamlObj = merge(...yamlObjList);
        }
        // console.log("obj", yamlObj);
        // 设置默认key
        const keys = Object.keys(yamlObj || {});
        let defaultKey = 'en';// 默认值
        if (Array.isArray(keys)) {
          if (keys.includes['zh-TW']) {// 特殊设置
            defaultKey = 'zh-TW';
          } else {
            defaultKey = keys[0];
          }
        }
        // langFilePath
        return { language: yamlObj, defaultKey, filePath: urlPath, langFilePath, type: 'yaml' };
      }
    } catch (e) {
      console.error('handleScanFileInner error', e);
    }
    return null;
  }

  static showDecoration(editor: vscode.TextEditor, positionObj: any, lang: object) {
    if (editor && positionObj) {
      const foregroundColor = new vscode.ThemeColor('editorCodeLens.foreground');

      // 坑：一定要先清空，否则会出现重复的情况，即使将全局变量decorationType改成局部变量也无效
      if (decorationType != null) {
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

  // 打开配置
  static openConfigCommand() {
    vscode.commands.executeCommand('workbench.action.openSettings', '国际多语言配置');// 用户区
  }

  // 分析与统计
  static async handleAnalystics(selectFolderPath: any, bigFileLineCount: number, base: string = 'src') {
    return new Promise(async (resolve, reject) => {
      try {
        if (!selectFolderPath) {
          return reject(null);
        }

        const folderPaths = selectFolderPath.replace(/\//g, path.sep).split(path.sep);
        // console.log("folderPaths", folderPaths);
        const len = folderPaths.length;
        if (len) {
          let folderUrl = folderPaths[len - 1];
          if (folderPaths.includes(base)) {
            folderUrl = folderPaths.slice(folderPaths.indexOf(base)).join(path.sep);
          }
          folderUrl = '**' + path.sep + folderUrl + path.sep + '**';;
          const files = await FileIO.getFiles(folderUrl);
          // console.log("files", files);
          let bigFileList = [], fileTypeObj = {}, indexFileObj = {};
          const addPath = (fsPath, count) => {
            let arr = fsPath.split(path.sep);
            let filePath = fsPath;
            if (arr.includes(base)) {
              filePath = arr.slice(arr.indexOf(base)).join(path.sep);
            }
            bigFileList.push({ path: filePath, count });
          };
          files.forEach(({ fsPath }) => {
            const indexFile = 'index';
            const fileName = path.basename(fsPath);
            const fileType = '.' + fileName.split('.')[1];
            const data = fs.readFileSync(fsPath, 'utf-8');
            const arr = data && data.match(/\n/g) || [];
            if (arr.length >= bigFileLineCount) {
              addPath(fsPath, arr.length);
            }
            if (fileName.startsWith(indexFile)) {
              if (!indexFileObj[fileName]) {
                indexFileObj[fileName] = 1;
              } else {
                indexFileObj[fileName]++;
              }
            }
            if (!fileTypeObj[fileType]) {
              fileTypeObj[fileType] = 1;
            } else {
              fileTypeObj[fileType]++;
            }
          });
          bigFileList.sort((a, b) => b.count - a.count);
          resolve({ bigFileList, fileTypeObj, indexFileObj });
        }
      } catch (e) {
        console.error("handleAnalystics e", e);
        reject(e);
      }
    });
  }

  // 统计本地无用的数据
  static async ananlysisLocalGlobal(filePath: any) {
    const prefix = `global_`;
    const globalLangObj = {};
    const newLangObj = {};
    const getObj = (fPath) => {
      const data = fs.readFileSync(fPath, 'utf-8');
      const startIndex = data.indexOf('{');
      const endIndex = data.lastIndexOf('}');
      if (startIndex < 0 || endIndex < 0) {
        return {};
      }
      const dataStr = data.substring(startIndex, endIndex + 1);
      const langObj = eval(`(${dataStr})`);
      return langObj;
    };
    const sourcePath = '**/src/i18n/locale/**';
    const files = await FileIO.getFiles(sourcePath);
    files.forEach(({ fsPath }) => {
      const fileName = path.basename(fsPath);
      const lang = fileName.split('.')[0];
      if (/\.(js)$/.test(fileName)) {
        try {
          globalLangObj[lang] = getObj(fsPath);
        } catch (e) {
          console.error(e);
        }
      }
    });
    if (!isEmpty(globalLangObj)) {
      Object.entries(globalLangObj).forEach((([lang, obj]) => {
        let langMap = {};
        Object.entries(obj).forEach(([k, v]) => {
          if (!k.startsWith(prefix) && globalLangObj['zh'] && globalLangObj['zh'][k]) {
            langMap[k] = v;
          }
        });
        newLangObj[lang] = langMap;
      }));
    }
    const fileName = '/未上传的文案集合.md';
    // const newFilePath = getBaseFilePath(filePath, fileName);
    // console.log('newFilePath', newFilePath);
    const newFilePath = await FileIO.writeContentToLocalFile(filePath, fileName, newLangObj);
    return newFilePath;
  }

  // 生成临时文件
  static getRandFileName(pageEnName: string, fileType: string) {
    const date = new Date();
    let rand = '';
    rand += date.getFullYear();
    rand += '-';
    rand += date.getMonth() + 1;
    rand += '-';
    rand += date.getDate();
    rand += '-';
    rand += date.getTime().toString().substr(-6);
    return `${pageEnName}_${rand}${fileType}`;
  }


  static getGenerateNewLangObj(keys: any[], defaultLang: string, initLang: string[], keyPrefix: string, varObj: any) {
    let langObj = {};
    if (keys.length) {
      if (defaultLang) {
        langObj[defaultLang] = {};
      };
      (initLang || []).forEach((lang) => {
        langObj[lang] = {};
      });
      (keys || []).filter(Boolean).forEach((char, i) => {
        const key = `${keyPrefix}${i}`;
        langObj[defaultLang][key] = (varObj && varObj[char] && varObj[char].newKey) || char;
        (initLang || []).forEach((lang) => {
          langObj[lang][key] = "";
        });
      });
    }
    return langObj;
  }

  /**
   * 扫描中文字符并初始化生成i18n
   * @param data 
   * @param filePath 
   */
  static handleScanAndInit(filePath: string, initLang: string[], quoteKeys: string[], defaultLang: string, prefixKey: string, isSingleQuote: boolean, keyBoundaryChars: string[], vueReg: RegExp, cb: Function) {
    try {
      // 判断当前文档是否包含i18n的引用
      if (vueReg.test(filePath)) {
        FileIO.handleReadStream(filePath, (data) => {
          if (data) {
            // 获取所有汉字文案
            const chars = Utils.getChineseCharList(data, keyBoundaryChars);
            console.log("chars", chars);
            if (!chars || !chars.length) { return; }
            // 获取新的文件内容
            const newContent = Utils.getVueNewContent(data, chars, initLang, quoteKeys, prefixKey, isSingleQuote);
            FileIO.handleWriteStream(filePath, newContent, () => { });
            // 处理含有变量的key
            const varObj: any = Utils.getVarObj(chars);
            // 提取数据
            const newLangObj = Utils.getGenerateNewLangObj(chars, defaultLang, initLang, prefixKey, varObj);
            cb(newLangObj);
          }
        });
      } else if (/\.(js|ts)$/.test(filePath)) {
        FileIO.handleReadStream(filePath, (data) => {
          if (data) {
            // 获取所有汉字文案
            const chars = Utils.getChineseCharList(data, keyBoundaryChars);
            console.log("chars", chars);
            if (!chars || !chars.length) { return; }
            // 获取新的文件内容
            const newContent = Utils.getJSNewContent(data, chars, quoteKeys, prefixKey, isSingleQuote);
            FileIO.handleWriteStream(filePath, newContent, () => { });
            // 处理含有变量的key
            const varObj: any = Utils.getVarObj(chars);
            // 提取数据
            const newLangObj = Utils.getGenerateNewLangObj(chars, defaultLang, initLang, prefixKey, varObj);
            cb(newLangObj);
          }
        });
      } else if (/\.(jsx|tsx)$/.test(filePath)) {
        FileIO.handleReadStream(filePath, (data) => {
          if (data) {
            // 获取所有汉字文案
            const chars = Utils.getChineseCharList(data, keyBoundaryChars);
            console.log("chars", chars);
            if (!chars || !chars.length) { return; }
            // 获取新的文件内容
            const newContent = Utils.getJSXNewContent(data, chars, quoteKeys, prefixKey, isSingleQuote);
            FileIO.handleWriteStream(filePath, newContent, () => { });
            // 处理含有变量的key
            const varObj: any = Utils.getVarObj(chars);
            // 提取数据
            const newLangObj = Utils.getGenerateNewLangObj(chars, defaultLang, initLang, prefixKey, varObj);
            cb(newLangObj);
          }
        });
      }
    } catch (e) {
      console.error("handleScanAndInit e", e);
    }
  }

  // 处理含有变量key
  static getVarObj = (keys: any[]) => {
    let varObj = {};
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        let newKey = key;
        if (newKey && newKey.indexOf('${') > -1) {
          const list = newKey.match(varReg);
          const newVarList = (list || []).filter(Boolean).map((item, i) => {
            newKey = newKey.replace(item, `{${i}}`);
            return item.replace(/[\$\{\}]/g, '');
          });
          // console.log("newVarList", newVarList);
          varObj[key] = { newKey, varList: newVarList };
        }
      });
    }
    return varObj;
  };

  /**
   * 获取注释位置
   * @param text 
   * @param startNote 
   * @param endNote 
   */
  static getNotePositionList(text: string, startNote: string, endNote: string) {
    // 注释位置
    const list = [];
    if (text) {
      let startIndex = -1;
      let endIndex = 0;
      while ((startIndex = text.indexOf(startNote, endIndex)) > -1) {
        endIndex = text.indexOf(endNote, startIndex + 1);
        list.push([startIndex, endIndex]);
      }
    }
    return list;
  }

  /**
   * 获取<i18n></i18n>中的对象
   * @param data 
   * @returns 
   */
  static getI18NObject(data: string) {
    let yamlObj = null;
    if (data && data.indexOf('</i18n>') > -1) {
      let yamlStr = '';
      let yamlObjList = [];
      let startIndex = -1;
      let endIndex = 0;
      while ((startIndex = data.indexOf('<i18n>', endIndex)) > -1) {// 可能存在多个的情况
        endIndex = data.indexOf('</i18n>', startIndex);
        yamlStr = data.substring(startIndex + 6, endIndex);
        yamlObjList.push(YAML.parse(yamlStr));
      }
      if (yamlObjList.length) {
        yamlObj = merge(...yamlObjList);
      }
    }
    return yamlObj;
  }

  /**
   * 判断是否在区间内
   * @param i 位置index
   * @param list 区间数组，如[[34, 89], [100, 200]]
   * @returns 
   */
  static isInRange(i: number, list: Array<any[]>) {
    if (!list.length) { return false; }

    list.sort((a, b) => a[0] - b[0]);

    // 使用二分查找查找合适的区间
    let left = 0;
    let right = list.length - 1;

    while (left <= right) {
      let mid = (left + right) >> 1;
      let [start, end] = list[mid];

      if (i < start) {
        right = mid - 1;
      } else if (i > end) {
        left = mid + 1;
      } else {
        return true;  // 如果 i 在当前的区间内，返回 true
      }
    }

    return false;  // 如果没有找到合适的区间，返回 false
  }

  /**
   * 提取所有中文字符串
   * @param data 
   * @returns 
   */
  static getChineseCharList(data: string, keyBoundaryChars: string[]) {
    let result = [];
    const excludes = ['v-track:'];
    const endChars = boundaryCodes.concat(keyBoundaryChars);
    const replaceKeys = [[/&nbsp;/g, ""]];
    if (data && chineseCharReg.test(data)) {
      const noteList0 = Utils.getNotePositionList(data, '<i18n>', '</i18n>');
      const noteList1 = Utils.getNotePositionList(data, '<!--', '-->');
      const noteList2 = Utils.getNotePositionList(data, '/*', '*/');
      const noteList3 = Utils.getNotePositionList(data, '//', '\n');
      const notePositionList = [].concat(noteList0, noteList1, noteList2, noteList3);
      let res = null, nextIndex = -1;
      while (res = chineseChar2Reg.exec(data)) {
        // console.log("res", res);
        const c = res[0], i = res.index;
        let begin = i - 1, end = i + 1;
        let key = c;
        if (i < nextIndex) { continue; }
        // 是否在注释位置
        if (Utils.isInRange(i, notePositionList)) { continue; }
        // 向前找
        while (!endChars.includes(data[begin])) {
          begin--;
        }
        // 向后找
        while (!endChars.includes(data[end])) {
          end++;
        }
        // 多行符需要特别处理
        if (data[begin] === '`') {
          while (data[end] !== '`') {
            end++;
          }
        }
        if (data[end] === '`') {
          while (data[begin] !== '`') {
            begin--;
          }
        }
        // console.log("data[begin]", data[begin], data[end])
        nextIndex = end;
        key = data.substring(begin + 1, end);
        // console.log("key", key);
        key = data[begin] === '`' ? key : key.trim();
        // 判断是否不含特殊字符
        if (excludes.some(k => key.includes(k))) { continue; }
        // 判断是否已存在
        if (!result.includes(key)) {
          result.push(key);
        }
      }
    }
    result = result.map(k => {
      (replaceKeys || []).forEach(item => {
        k = k.replace(item[0], item[1]);
      });
      return k;
    });
    return result;
  }

  /**
   * 获取新的文件字符串，针对vue
   * @param data 
   * @param chars 
   * @param notePositionList 
   * @returns 
   */
  static getVueNewContent(data: string, chars: any[], initLang: string[], quoteKeys: string[], keyPrefix: string, isSingleQuote: boolean) {
    // 将key写入i18n
    let newData = data;
    if (data && chars.length) {
      // 处理含有变量的key
      const varObj: any = Utils.getVarObj(chars);
      // 获取新的$t引用
      const getI18nT = (suffix: string, key: string, char: string) => {
        const keyStr = isSingleQuote ? `'${key}'` : `"${key}"`;
        let i18nT = `${suffix}(${keyStr})`;
        if (varObj[char]) {
          i18nT = `${suffix}(${keyStr}, [${varObj[char].varList}])`;
        }
        return i18nT;
      };

      const getScriptType = (str: string) => {
        const reg = /<script.*?>/;
        const arr = reg.exec(str);
        if (arr) {
          return arr[0].length + arr.index;
        } else {
          return -1;
        }
      };

      const getTemplateStr = (keys: any[]) => {
        if (data.indexOf('<template>') < 0) {
          return '';
        };
        const templateStartIndex = data.indexOf('<template>') + '<template>'.length;
        const templateEndIndex = data.lastIndexOf('</template>');
        // console.log("templateStartIndex", templateStartIndex, templateEndIndex)
        let text = data.substring(templateStartIndex, templateEndIndex);
        // console.log("template", text);
        // const replaceKey = quoteKeys.includes('$t') ? '$t' : quoteKeys[0];
        const replaceKey = quoteKeys.length > 2 ? quoteKeys[1] : quoteKeys[0];
        (keys || []).forEach((char, i) => {
          const key = `${keyPrefix}${i}`;
          const i18nT = getI18nT(replaceKey, key, char);

          let startIndex = -1, endIndex = 0;
          while ((startIndex = text.indexOf(char, endIndex)) > -1) {
            // console.log("i18nT", i18nT, startIndex);
            endIndex = startIndex + char.length;
            let preIndex = startIndex - 2, str = '', pre = text[startIndex - 1], suff = text[endIndex];
            // console.log("text[endIndex]", pre, suff)
            if (chineseCharReg.test(pre) || chineseCharReg.test(suff)) {// 前后的字符还是中文，说明属于包含关系
              continue;
            }

            if (preIndex >= 0 && text[preIndex] === '=') {
              while (text[preIndex] !== ' ') {
                if (text[preIndex] === '\n' || text[preIndex] === ' ' || preIndex < 0) { break; }
                preIndex--;
              }
              preIndex = preIndex + 1;
              str = ':' + text.substring(preIndex, endIndex);
              str = str.replace(char, i18nT);
              text = text.slice(0, preIndex) + str + text.slice(endIndex);
            } else if (boundaryCodes.includes(suff) && pre === suff) {// 冒号的引用
              str = i18nT;
              text = text.slice(0, startIndex - 1) + str + text.slice(endIndex + 1);
            } else {
              str = `{{ ${i18nT} }}`;
              text = text.slice(0, startIndex) + str + text.slice(endIndex);
            }
          }
        });
        return text;
      };

      const getScriptStr = (keys: any[]) => {
        const scriptStartIndex = getScriptType(data);
        const scriptEndIndex = data.lastIndexOf('</script>');
        // console.log("scriptStartIndex", scriptStartIndex, scriptEndIndex)
        let text = data.substring(scriptStartIndex, scriptEndIndex);
        // console.log("script", text);
        (keys || []).filter(Boolean).forEach((char, i) => {
          const key = `${keyPrefix}${i}`;
          const replaceKey = quoteKeys.includes('this.$t') ? 'this.$t' : quoteKeys[0];
          const i18nT = getI18nT(replaceKey, key, char);
          let completionKeyStr = Utils.getRegExpStr(char);
          const reg = new RegExp(`[\`'"](${completionKeyStr})[\`'"]`, "g");
          // const reg = new RegExp(`['"\`](${char})['"\`]`, "g");
          text = text.replace(reg, `${i18nT}`);
        });
        return text;
      };

      const handleTemplate = () => {
        // 将原文件替换$t('key')形式
        const templateStr = getTemplateStr(chars);
        if (templateStr) {
          const templateStartIndex = newData.indexOf('<template>') + '<template>'.length;
          const templateEndIndex = newData.lastIndexOf('</template>');
          newData = newData.slice(0, templateStartIndex) + templateStr + newData.slice(templateEndIndex);
        }
      };

      const handleScript = () => {
        // 将原文件替换$t('key')形式
        const scriptStr = getScriptStr(chars);
        const scriptStartIndex = getScriptType(newData);
        const scriptEndIndex = newData.lastIndexOf('</script>');
        newData = newData.slice(0, scriptStartIndex) + scriptStr + newData.slice(scriptEndIndex);
      };

      // // 将key写入i18n
      // handleI18N();
      // 将原文件替换$t('key')形式
      handleTemplate();
      handleScript();
    }
    return newData;
  }

  /**
   * 获取新的文件字符串，针对js/ts
   * @param data 
   * @param chars 
   * @param notePositionList 
   * @returns 
   */
  static getJSNewContent(data: string, chars: any[], quoteKeys: string[], keyPrefix: string, isSingleQuote: boolean) {
    // 将key写入i18n
    let newData = data;
    if (data && chars.length) {
      // 处理含有变量的key
      const varObj: any = Utils.getVarObj(chars);
      // 获取新的$t引用
      const getI18nT = (suffix: string, key: string, char: string) => {
        const keyStr = isSingleQuote ? `'${key}'` : `"${key}"`;
        let i18nT = `${suffix}(${keyStr})`;
        if (varObj[char]) {
          i18nT = `${suffix}(${keyStr}, [${varObj[char].varList}])`;
        }
        return i18nT;
      };


      const replaceI18nStr = (keys: any[]) => {
        let text = data;
        // console.log("script", text);
        const replaceKey = quoteKeys.includes('i18n.t') ? 'i18n.t' : quoteKeys[quoteKeys.length - 1];
        (keys || []).filter(Boolean).forEach((char, i) => {
          const key = `${keyPrefix}${i}`;
          const i18nT = getI18nT(replaceKey, key, char);
          let completionKeyStr = Utils.getRegExpStr(char);
          const reg = new RegExp(`[\`'"](${completionKeyStr})[\`'"]`, "g");
          // const reg = new RegExp(`['"\`](${char})['"\`]`, "g");
          text = text.replace(reg, `${i18nT}`);
        });
        return text;
      };

      const handleReplace = () => {
        // 初始化中文和日语
        const i18nStr = replaceI18nStr(chars);
        const singleImport = `import i18n from '@/i18n'`;
        const doubleImport = `import i18n from "@/i18n"`;
        const i18nImportStr = isSingleQuote ? singleImport : doubleImport;
        const importStr = quoteKeys.includes('i18n.t') && (i18nStr.indexOf(singleImport) === -1 && i18nStr.indexOf(doubleImport) === -1) ? `${i18nImportStr}\n` : '';
        newData = importStr + i18nStr;
      };

      // // 写入全局变量文件
      // handleInsertI18nFile();
      // 将原文件替换i18n.$t('key')形式
      handleReplace();
    }
    return newData;
  }

  /**
   * 获取新的文件字符串，针对jsx
   * @param data 
   * @param chars 
   * @param notePositionList 
   * @returns 
   */
  static getJSXNewContent(data: string, chars: any[], quoteKeys: string[], keyPrefix: string, isSingleQuote: boolean) {
    // 将key写入i18n
    let newData = data;
    if (data && chars.length) {
      // 处理含有变量的key
      const varObj: any = Utils.getVarObj(chars);
      const getI18nT = (suffix: string, key: string, char: string) => {
        const keyStr = isSingleQuote ? `'${key}'` : `"${key}"`;
        let i18nT = `${suffix}(${keyStr})`;
        if (varObj[char]) {
          i18nT = `${suffix}(${keyStr}, [${varObj[char].varList}])`;
        }
        return i18nT;
      };

      const replaceI18nStr = (keys: any[]) => {
        let text = data;
        // console.log("script", text);
        (keys || []).filter(Boolean).forEach((char, i) => {
          const key = `${keyPrefix}${i}`;
          const replaceKey = quoteKeys[0];
          const i18nT = getI18nT(replaceKey, key, char);
          let completionKeyStr = Utils.getRegExpStr(char);
          const reg = new RegExp(`=[\`'"](${completionKeyStr})[\`'"]`, "g");
          // const reg = new RegExp(`['"\`](${char})['"\`]`, "g");
          text = text.replace(reg, `={${i18nT}}`);
        });
        (keys || []).filter(Boolean).forEach((char, i) => {
          const key = `${keyPrefix}${i}`;
          const replaceKey = quoteKeys[0];
          const i18nT = getI18nT(replaceKey, key, char);
          let completionKeyStr = Utils.getRegExpStr(char);
          const reg = new RegExp(`[\`'"](${completionKeyStr})[\`'"]`, "g");
          // const reg = new RegExp(`['"\`](${char})['"\`]`, "g");
          text = text.replace(reg, `${i18nT}`);
        });
        (keys || []).filter(Boolean).forEach((char, i) => {
          const key = `${keyPrefix}${i}`;
          const replaceKey = quoteKeys[0];
          const i18nT = getI18nT(replaceKey, key, char);
          let completionKeyStr = Utils.getRegExpStr(char);
          const reg = new RegExp(`(${completionKeyStr})`, "g");
          // const reg = new RegExp(`['"\`](${char})['"\`]`, "g");
          text = text.replace(reg, `{${i18nT}}`);
        });
        return text;
      };

      const handleReplace = () => {
        const i18nStr = replaceI18nStr(chars);
        // const newText = getDomStr(chars, i18nStr);
        newData = i18nStr;
      };

      // 将原文件替换
      handleReplace();
    }
    return newData;
  }

  // 获取字符串的字节数
  static getBitCount(str: string) {
    let count = 0;
    const arr = str.split('');
    arr.forEach((c: string) => {
      count += Math.ceil(c.charCodeAt(0).toString(2).length / 8);
    });
    return count;
  }

  // 调用百度翻译-同步翻译文件
  // https://fanyi-api.baidu.com/doc/21
  static async getTransSourceObjByBaidu(localLangObj: Object, defaultLang: string, baiduAppid: string, baiduSecrectKey: string, isOverWriteLocal: boolean = false) {
    const transSourceObj = {};
    const result = { transSourceObj: null, message: '' };
    if (isEmpty(localLangObj)) { return result; }
    const defaultSource = localLangObj[defaultLang];
    if (isEmpty(defaultSource)) { return result; }
    const nt = '<br>';
    // 获取源文案
    Object.entries(localLangObj).map(([lang, obj]) => {
      if (lang !== defaultLang) {
        if (!transSourceObj[lang]) {
          transSourceObj[lang] = {};
        }
        Object.keys(obj).forEach((k) => {
          if (!obj[k]) {
            const keyStr = defaultSource[k];
            if (keyStr) {// 有翻译源文案
              transSourceObj[lang][keyStr] = obj[k];
            }
          }
        });
      }
    });

    const getTransText = (obj: any = {}, max: number = 6000) => {
      const text = Object.keys(obj).map((v: string, i: number) => {
        if (i < max) {
          return (v || '').toString().replace(/\n/g, nt);
        }
        return null;
      }).filter(v => v !== null).join('\n');
      const bitLen = Utils.getBitCount(text);
      if (bitLen > max) {
        const len = Object.keys(obj).length;
        return getTransText(obj, len / 2);
      } else {
        return text;
      }
    };

    const langs = Object.keys(transSourceObj);
    // 判断超长
    if (!baiduAppid || !baiduSecrectKey) {
      let count = 0;
      for (let lang of langs) {
        const text2 = getTransText(transSourceObj[lang]);
        count += Utils.getBitCount(text2);
      }
      if (count > 1000) {
        // // 记录用户行为数据
        // reporter?.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
        // 	action: "在线翻译-外部",
        //   count: `字节数${count}`,
        // 	error: `翻译文案过长，建议开通百度翻译账号，并在du-i18n.config.json文件中设置自己专属的baiduAppid和baiduSecrectKey`
        // });
        result.message = `翻译文案过长，建议开通百度翻译账号，并在du-i18n.config.json文件中设置自己专属的baiduAppid和baiduSecrectKey`;
        return result;
      }
    }

    const task = async (lang: string) => {
      return new Promise(async (resolve, reject) => {
        try {
          const q = getTransText(transSourceObj[lang]);
          if (!q) {
            // showMessage(`${defaultLang}的源文案不能为空！`, MessageType.WARNING);
            result.message = `${defaultLang}的源文案不能为空！`;
            throw new Error(`${defaultLang}的源文案不能为空！`);
          }
          const params = {
            from: defaultLang,
            to: lang,
            q,
            baiduAppid,
            baiduSecrectKey,
          };
          console.log('params', params);
          const { data, message } = await Baidu.getTranslate(params);
          console.log("baidu data", data);
          if (data && Array.isArray(data.trans_result)) {
            data.trans_result.forEach(item => {
              let key = item.src;
              if (key) {
                key = key.replaceAll(nt, '\n');
                transSourceObj[lang][key] = item.dst;
              }
            });
            resolve(transSourceObj);
          } else {
            result.message = message;
            throw new Error(data.error_code);
          }
          // console.log('transSourceObj', transSourceObj);
        } catch (e) {
          // // 记录用户行为数据
          // reporter?.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
          //   action: "在线翻译-外部-异常",
          //   error: e,
          // });
          reject(e);
        }
      });
    };
    const taskList = langs.map(lang => () => task(lang));
    try {
      // 目前同一个文件多种翻译语言，只要有一个翻译出错，就返回null报错
      await Utils.limitedParallelRequests(taskList, 1);
      result.transSourceObj = transSourceObj;
      return result;
    } catch (e) {
      console.log('limitedParallelRequests', e);
      return result;
    }
  }

  /**
   * 处理-同步翻译
   */
  static async translateLocalFile(transSourceObj: any, defaultLang: string, tempPaths: string, filePath: string, isOverWriteLocal: boolean) {
    // console.log('translateLocalFile', transSourceObj, defaultLang, tempPaths, isOverWriteLocal);
    const tranLocalFile = (fsPath: string) => {
      const fileName = path.basename(fsPath);
      if (/\.(json)$/.test(fileName)) {
        try {
          const data = fs.readFileSync(fsPath, 'utf-8');
          if (data) {
            const localLangObj = eval(`(${data})`);
            if (localLangObj) {
              const zhSource = localLangObj[defaultLang];
              if (!isEmpty(zhSource)) {
                // 处理转译
                Object.entries(localLangObj).forEach(([lang, obj]) => {
                  // console.log('lang', lang, defaultLang);
                  if (lang !== defaultLang) {
                    const source = transSourceObj[lang] || {};
                    Object.keys(obj).forEach((k) => {
                      const chieseStr = zhSource[k];
                      // console.log('obj', k, obj[k]);
                      // console.log('source', chieseStr, source[chieseStr]);
                      if (isOverWriteLocal) {// 本地有值的会覆盖
                        obj[k] = source[chieseStr] || "";
                      } else {
                        if (!obj[k]) {// 本地有值的不会覆盖
                          obj[k] = source[chieseStr] || "";
                        }
                      }
                    });
                  }
                });
                // 写入新内容
                const newText = JSON.stringify(localLangObj, null, '\t');
                FileIO.writeFileToLine(fsPath, newText);
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
    if (!isEmpty(transSourceObj) && defaultLang) {
      if (filePath) {
        tranLocalFile(filePath);
      } else if (tempPaths) {
        const files = await FileIO.getFiles(tempPaths);// 读取临时文件
        files.forEach(({ fsPath }) => {
          tranLocalFile(fsPath);
        });
      }
    }
  }

  static getI18NObjectInJS(filePath: string, globalLangObj: any = {}) {
    let obj = null;
    if (filePath && /\.(js|ts)$/.test(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const reg = /i18n\.t\([^\)]*?\)/g;
      if (data && reg.test(data)) {
        const allKeys = data.match(reg);
        const initLang = ['zh', 'en', 'ja'];
        obj = {};
        // console.log("allKeys", allKeys);
        allKeys.forEach((k: any) => {
          k = k.replace('i18n.t', '');
          k = k.replace(/[\t\n'"\(\)]/g, '');
          initLang.forEach(lang => {
            if (!obj[lang]) {
              obj[lang] = {};
            }
            obj[lang][k] = globalLangObj[lang][k];
          });
        });
      }
    }
    return obj;
  }

  static async limitedParallelRequests<T>(
    requests: (() => Promise<T>)[], // 请求函数数组
    maxConcurrency: number // 最大并发请求数
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<number>[] = []; // 当前执行中的请求

    for (const request of requests) {
      const task = request().then(result => results.push(result)); // 执行请求并保存结果

      executing.push(task);

      // 限制并发请求数
      if (executing.length >= maxConcurrency) {
        // 等待最早的请求完成
        await Promise.race(executing);
        // 移除已经完成的请求
        executing.splice(executing.findIndex(p => p === task), 1);
      }
    }

    // 等待所有请求完成
    await Promise.all(executing);

    return results;
  }

}
