import * as vscode from 'vscode';
import MapCache from './cache';
import * as Baidu from './baidu';
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

/**
 * 获取复制对象的value
 * 如{ "a.b": 1, a: { c: 2, d: [{e: 'e'}, {f: 'f'}] } }，获取obj, 'a.d.1.f'
 * @param obj 
 * @param key 
 * @returns 
 */
export function getObjectValue(obj: any, key: string) {
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

export function getStringValue(val: any) {
  if (Object.prototype.toString.call(val) === '[object Object]' || Array.isArray(val)) {
    return JSON.stringify(val);
  }
  return val ? val.toString() : val;
}

export function getRegExpStr(str: string) {
  if (str) {
    return str.replace(/([\.\(\)\$\*\+\[\?\]\{\}\|\^\\])/g, '\\$1');
  }
  return '';
}

export function getRegExp(str: string) {
  if (!RegCache.get(str)) {
    let completionKeyStr = getRegExpStr(str);
		completionKeyStr = completionKeyStr.split(',').map(c => c.trim()).filter(Boolean).join('|');
		const reg = new RegExp(`([\\s{'"]+)(${completionKeyStr})([\\('"])?`);
    RegCache.set(str, reg);
  }
  return RegCache.get(str);
}

export function getStringText(val: any) {
  if (Array.isArray(val) || Object.prototype.toString.call(val) === '[object Object]') {
    return JSON.stringify(val);
  }
  return val ? val.toString() : val;
}

export function replaceText(data: string, template: string, newText: string) {
  if (!data) {return data;}
  const startIndex = data.indexOf(template) + template.length;
  const endIndex = data.indexOf(template, startIndex);
  return data.slice(0, startIndex) + newText + data.slice(endIndex);
}

// 写入流文件
export function handleWriteStream(path: string, data: string, callback: Function) {
  // 创建一个可以写入的流，写入到文件中
  let writerStream = fs.createWriteStream(path);

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

// 读取流文件
export function handleReadStream(path: string, callback: Function) {
  let data = '';

  // 创建可读流
  let readerStream = fs.createReadStream(path);

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

// 同步写入json文件
export function writeJsonFileSync(path: string, text: string) {
  try {
    const data = fs.readFileSync(path, 'utf-8');
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
      return writeFileToLine(path, newStr);
    }
    return false;
  } catch(e) {
    console.error("writeJsonFileSync e", e);
    return false;
  }
}

// 同步写入yml文件
export function writeYmlFileSync(path: string, key: string, text: string) {
  try {
    // console.log("path", path);
    const data = fs.readFileSync(path, 'utf-8');
    if (data && key) {
      // 公司内部自定义的格式
      if (/\.(vue)$/.test(path) && data.indexOf('</i18n>') > -1) {
        const startIndex = data.indexOf('<i18n>') + 6;
        const endIndex = data.indexOf('</i18n>', startIndex);
        const yamlStr = data.substring(startIndex, endIndex);
        // console.log("yamlStr", yamlStr);
        const yamlObj = YAML.parse(yamlStr);

        const keyStr = YAML.stringify(yamlObj[key]) + text;
        yamlObj[key] = YAML.parse(keyStr);
        const newText = '\n' + YAML.stringify(yamlObj);
        const newStr= data.slice(0, startIndex) + newText + data.slice(endIndex);
        return writeFileToLine(path, newStr);
      } else {
        if (/\.(yaml|yml)$/.test(path)) {
          const yamlObj = YAML.parse(data);
          const keyStr = YAML.stringify(yamlObj[key]) + text;
          yamlObj[key] = YAML.parse(keyStr);
          const newText = YAML.stringify(yamlObj);
          return writeFileToLine(path, newText);
        }
      }
    }
    return false;
  } catch(e) {
    console.error("writeYmlFileSync e", e);
    return false;
  }
}

export function writeFileToLine(path: string, str: string) {
  try {
    fs.writeFileSync(path, str);
    return true;
  } catch(e) {
    console.error("writeFileToLine e", e);
    return false;
  }
}

export function handleScanFileInner(data: string, filePath: string) {
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
      while((startIndex = data.indexOf('<i18n>', endIndex)) > -1) {// 可能存在多个的情况
        endIndex = data.indexOf('</i18n>', startIndex);
        yamlStr = data.substring(startIndex + 6, endIndex);
        urlPath = filePath;
        yamlObjList.push(YAML.parse(yamlStr));
      }
      // discard: 废弃老的h5检测，先去掉耗性能
      // while(res = i18nSrcReg.exec(data)) {// 可能存在多个的情况
      //   count++;
			// 	let url = res[1].replace(/["']/g, '');
      //   // console.log("url2", url);
      //   url = path.join(path.dirname(filePath), url);
      //   const fileName = path.basename(url);
		  //   const key = fileName.substring(0, fileName.indexOf('.'));
      //   urlPath = url;
      //   langFilePath[key] = url;
      //   yamlStr = fs.readFileSync(url, 'utf-8');
      //   yamlObjList.push(YAML.parse(yamlStr));
      // }

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
	} catch(e) {
		console.error('handleScanFileInner error', e);
	}
	return null;
}

export async function getFiles(includePaths: string) {
	const files = await vscode.workspace.findFiles(`{${includePaths}}`, `{**/node_modules/**, **/.git/**, **/@types/**, **/.vscode/**, **.d.ts, **/.history/**}`);
	return files;
}

export function showDecoration(editor: vscode.TextEditor, positionObj: any, lang: object) {
	if (editor && positionObj) {
    const foregroundColor = new vscode.ThemeColor('editorCodeLens.foreground');
    
    // 坑：一定要先清空，否则会出现重复的情况，即使将全局变量decorationType改成局部变量也无效
    if(decorationType != null) {
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
				const value = getObjectValue(lang, v);
				const text = getStringText(value); 
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
export function openConfigCommand() {
	vscode.commands.executeCommand('workbench.action.openSettings', '国际多语言配置');// 用户区
}

// 分析与统计
export async function handleAnalystics(selectFolderPath: any, bigFileLineCount: number, base: string='src') {
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
        const files = await getFiles(folderUrl);
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
    } catch(e) {
      console.error("handleAnalystics e", e);
      reject(e);
    }
  });
}

export async function getProjectInfo() {
  const projectInfoList = [];
  try {
    const basePath = getBasePath();
    const fsPath = path.join(basePath, 'package.json');
    const data = fs.readFileSync(fsPath, 'utf-8');
    if (data) {
      const pkObj = eval(`(${data})`);
      if (!isEmpty(pkObj)) {
        const { name, description, version } = pkObj || {};
        projectInfoList.push({name, description, version});
      }
    }
  } catch(e) {
    console.error(e);
  }
  return projectInfoList;
}

/**
 * 读取所有包含package.json目录，取路径最短的那一个作为根目录
 * @returns 
 */
export async function getBasePath() {
  let basePath = '';
  let pkgPath = globalPkgPath;
  const files = await getFiles(pkgPath);
  files.forEach(({ fsPath }) => {
    let item = path.dirname(fsPath);
    if (!basePath) {
      basePath = item;
    } else {
      if (item.length < basePath.length) {
        basePath = item;
      }
    }
  });
  // console.log('basePath', basePath);
  return basePath;
}

export async function getBaseFilePath(fsPath: string, fileName: string) {
  const basePath = await getBasePath();
  return path.join(basePath, fileName);
}

// 创建文件
export async function createFile(basePath: string, fileName: string, content: any='') {
  let newFilePath = await getBaseFilePath(basePath, fileName);
  // console.log('newFilePath', newFilePath, newText)
  if (newFilePath) {
    writeFileToLine(newFilePath, content);
  }
  return newFilePath;
}

// 将obj内容写入本地文件
export async function writeContentToLocalFile(basePath: any, fileName: any, conentObj: any) {
  let newText = conentObj;
  if (isObject(conentObj)) {
    newText = JSON.stringify(conentObj, null, '\t');
  }
  const filePath = await createFile(basePath, fileName, newText);
  console.log('filePath', filePath);
  return filePath;
}

// 统计本地无用的数据
export async function ananlysisLocalGlobal(filePath: any) {
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
  const files = await getFiles(sourcePath);
  files.forEach(({ fsPath }) => {
    const fileName = path.basename(fsPath);
    const lang = fileName.split('.')[0];
    if (/\.(js)$/.test(fileName)) {
      try {
        globalLangObj[lang] = getObj(fsPath);
      } catch(e) {
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
  const newFilePath = await writeContentToLocalFile(filePath, fileName, newLangObj);
  return newFilePath;
}

// 生成临时文件
function getRandFileName(pageEnName: string, fileType: string) {
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

// 递归创建文件夹
export function mkdirs(dirPaths: string) {
  if (!fs.existsSync(path.dirname(dirPaths))) {
    mkdirs(path.dirname(dirPaths));
  }
  fs.mkdirSync(dirPaths);
}

// 写入临时文件
export async function writeIntoTempFile(tempPaths: string, filePath: string, newLangObj: any, pageEnName: string, tempFileName: string, isNeedRandSuffix: boolean, cb: Function) {
  try {
    let newPath = await getBaseFilePath(filePath, tempPaths);
    newPath = newPath.replace(/\*/g, '');
    if (!fs.existsSync(newPath)) {
      mkdirs(newPath);
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
        randFileName = getRandFileName(pageEnName, '.json');
      } else {
        randFileName = pageEnName + '.json';
      }
      // 拼接文件路径
      newFilePath = path.join(newPath, randFileName);
    }
    if (!content) {
      content = JSON.stringify(newLangObj, null, '\t');
    }
    if (writeFileToLine(newFilePath, content)) {
      cb(newFilePath, newLangObj);
    };
  } catch (e) {
    console.error(e);
  }
};

// 拆分语言文件
export async function generateLangFile(langPaths: string, filePath: string, localLangObj: any, cb: Function) {
  try {
    let newPath = await getBaseFilePath(filePath, langPaths);
    newPath = newPath.replace(/\*/g, '');
    if (!fs.existsSync(newPath)) {
      mkdirs(newPath);
    }
    console.log('newPath', newPath);
    console.log('localLangObj', localLangObj);
    if (!isEmpty(localLangObj)) {
      Object.entries(localLangObj).forEach(([lang, obj]) => {
        const langFileName = lang + '.json';
        const newFilePath = path.join(newPath, langFileName);
        const content = JSON.stringify(obj, null, '\t');
        writeFileToLine(newFilePath, content);
      });
    }
    cb(newPath);
  } catch (e) {
    console.error(e);
  }
};

export function getGenerateNewLangObj(keys: any[], defaultLang: string, initLang: string[], keyPrefix: string, varObj: any) {
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
export function handleScanAndInit(filePath: string, initLang: string[], quoteKeys: string[], defaultLang: string, prefixKey: string, isSingleQuote: boolean, keyBoundaryChars: string[], cb: Function) {
  try {
    // 判断当前文档是否包含i18n的引用
    if (/\.(vue)$/.test(filePath)) {
      handleReadStream(filePath, (data) => {
        if (data) {
          // 获取所有汉字文案
          const chars = getChineseCharList(data, keyBoundaryChars);
          console.log("chars", chars);
          if (!chars || !chars.length) {return;}
          // 获取新的文件内容
          const newContent = getVueNewContent(data, chars, initLang, quoteKeys, prefixKey, isSingleQuote);
          handleWriteStream(filePath, newContent, () => {});
          // 处理含有变量的key
          const varObj: any = getVarObj(chars);
          // 提取数据
          const newLangObj = getGenerateNewLangObj(chars, defaultLang, initLang, prefixKey, varObj);
          cb(newLangObj);
        }
      });
    } else if (/\.(js|ts)$/.test(filePath)) {
      handleReadStream(filePath, (data) => {
        if (data) {
          // 获取所有汉字文案
          const chars = getChineseCharList(data, keyBoundaryChars);
          console.log("chars", chars);
          if (!chars || !chars.length) {return;}
          // 获取新的文件内容
          const newContent = getJSNewContent(data, chars, quoteKeys, prefixKey, isSingleQuote);
          handleWriteStream(filePath, newContent, () => {});
          // 处理含有变量的key
          const varObj: any = getVarObj(chars);
          // 提取数据
          const newLangObj = getGenerateNewLangObj(chars, defaultLang, initLang, prefixKey, varObj);
          cb(newLangObj);
        }
      });
    } else if (/\.(jsx|tsx)$/.test(filePath)) {
      handleReadStream(filePath, (data) => {
        if (data) {
          // 获取所有汉字文案
          const chars = getChineseCharList(data, keyBoundaryChars);
          console.log("chars", chars);
          if (!chars || !chars.length) {return;}
          // 获取新的文件内容
          const newContent = getJSXNewContent(data, chars, quoteKeys, prefixKey, isSingleQuote);
          handleWriteStream(filePath, newContent, () => {});
          // 处理含有变量的key
          const varObj: any = getVarObj(chars);
          // 提取数据
          const newLangObj = getGenerateNewLangObj(chars, defaultLang, initLang, prefixKey, varObj);
          cb(newLangObj);
        }
      });
    }
  } catch(e) {
    console.error("handleScanAndInit e", e);
  }
}

// 处理含有变量key
export const getVarObj = (keys: any[]) => {
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
function getNotePositionList(text: string, startNote: string, endNote: string) {
  // 注释位置
  const list = [];
  if (text) {
    let startIndex = -1;
    let endIndex = 0;
    while((startIndex = text.indexOf(startNote, endIndex)) > -1) {
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
export function getI18NObject(data: string) {
  let yamlObj = null;
  if (data && data.indexOf('</i18n>') > -1) {
    let yamlStr = '';
    let yamlObjList = [];
    let startIndex = -1;
    let endIndex = 0;
    while((startIndex = data.indexOf('<i18n>', endIndex)) > -1) {// 可能存在多个的情况
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
function isInRange(i: number, list: Array<any[]>) {
  if (!list.length) return false;

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
function getChineseCharList(data: string, keyBoundaryChars: string[]) {
  let result = [];
  const excludes = ['v-track:'];
  const endChars = boundaryCodes.concat(keyBoundaryChars);
  const replaceKeys = [[/&nbsp;/g, ""]];
  if (data && chineseCharReg.test(data)) {
    const noteList0 = getNotePositionList(data, '<i18n>', '</i18n>');
    const noteList1 = getNotePositionList(data, '<!--', '-->');
    const noteList2 = getNotePositionList(data, '/*', '*/');
    const noteList3 = getNotePositionList(data, '//', '\n');
    const notePositionList = [].concat(noteList0, noteList1, noteList2, noteList3);
    let res = null, nextIndex = -1;
    while(res = chineseChar2Reg.exec(data)) {
      // console.log("res", res);
      const c = res[0], i = res.index;
      let begin = i - 1, end = i + 1;
      let key = c;
      if (i < nextIndex) {continue;}
      // 是否在注释位置
      if (isInRange(i, notePositionList)) {continue;}
      // 向前找
      while(!endChars.includes(data[begin])) {
        begin--;
      }
      // 向后找
      while(!endChars.includes(data[end])) {
        end++;
      }
      // 多行符需要特别处理
      if (data[begin] === '`') {
        while(data[end] !== '`') {
          end++;
        }
      }
      if (data[end] === '`') {
        while(data[begin] !== '`') {
          begin--;
        }
      }
      // console.log("data[begin]", data[begin], data[end])
      nextIndex = end;
      key = data.substring(begin + 1, end);
      // console.log("key", key);
      key = data[begin] === '`' ? key : key.trim();
      // 判断是否不含特殊字符
      if (excludes.some(k => key.includes(k))) {continue;}
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
function getVueNewContent(data: string, chars: any[], initLang: string[], quoteKeys: string[], keyPrefix: string, isSingleQuote: boolean) {
  // 将key写入i18n
  let newData = data;
  if (data && chars.length) {
    // 处理含有变量的key
    const varObj: any = getVarObj(chars);
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
        while((startIndex = text.indexOf(char, endIndex)) > -1) {
          // console.log("i18nT", i18nT, startIndex);
          endIndex = startIndex + char.length;
          let preIndex = startIndex - 2, str = '', pre = text[startIndex - 1], suff = text[endIndex];
          // console.log("text[endIndex]", pre, suff)
          if (chineseCharReg.test(pre) || chineseCharReg.test(suff)) {// 前后的字符还是中文，说明属于包含关系
            continue;
          }
          
          if (preIndex >= 0 && text[preIndex] === '=') {
            while (text[preIndex] !== ' ') {
              if (text[preIndex] === '\n' || text[preIndex] === ' ' || preIndex < 0) {break;}
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
        let completionKeyStr = getRegExpStr(char);
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
 function getJSNewContent(data: string, chars: any[], quoteKeys: string[], keyPrefix: string, isSingleQuote: boolean) {
  // 将key写入i18n
  let newData = data;
  if (data && chars.length) {
    // 处理含有变量的key
    const varObj: any = getVarObj(chars);
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
        let completionKeyStr = getRegExpStr(char);
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
 function getJSXNewContent(data: string, chars: any[], quoteKeys: string[], keyPrefix: string, isSingleQuote: boolean) {
  // 将key写入i18n
  let newData = data;
  if (data && chars.length) {
    // 处理含有变量的key
    const varObj: any = getVarObj(chars);
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
        let completionKeyStr = getRegExpStr(char);
        const reg = new RegExp(`=[\`'"](${completionKeyStr})[\`'"]`, "g");
        // const reg = new RegExp(`['"\`](${char})['"\`]`, "g");
        text = text.replace(reg, `={${i18nT}}`);
      });
      (keys || []).filter(Boolean).forEach((char, i) => {
        const key = `${keyPrefix}${i}`;
        const replaceKey = quoteKeys[0];
        const i18nT = getI18nT(replaceKey, key, char);
        let completionKeyStr = getRegExpStr(char);
        const reg = new RegExp(`[\`'"](${completionKeyStr})[\`'"]`, "g");
        // const reg = new RegExp(`['"\`](${char})['"\`]`, "g");
        text = text.replace(reg, `${i18nT}`);
      });
      (keys || []).filter(Boolean).forEach((char, i) => {
        const key = `${keyPrefix}${i}`;
        const replaceKey = quoteKeys[0];
        const i18nT = getI18nT(replaceKey, key, char);
        let completionKeyStr = getRegExpStr(char);
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


/**
 * 批量处理-中文转译
 * @param selectFolderPath 目标文件路径
 * @param sourceData 翻译数据
 * @param translateLangs 翻译语言
 */
 export async function handleMultiTranslateFromChineseKey(selectFolderPath: any, sourceData: any, translateLangs: string[]) {
  try {
    if (!selectFolderPath) {return;}
    const folderPaths = selectFolderPath.replace(/\//g, path.sep).split(path.sep);
    // console.log("folderPaths", folderPaths);
    const len = folderPaths.length;
    if (len) {
      let folderUrl = folderPaths[len - 1];
      if (folderPaths.includes('src')) {
        folderUrl = folderPaths.slice(folderPaths.indexOf('src')).join(path.sep);
      }
      folderUrl = '**' + path.sep + folderUrl + path.sep + '**';;
      // console.log("folderUrl", folderUrl);
      const files = await getFiles(folderUrl);
      // console.log("files", files);
      files.forEach(({ fsPath }) => {
        translateFromChineseKey(fsPath, sourceData, translateLangs);
      });
    }
  } catch(e) {
    console.error("handleMultiTranslateFromChineseKey e", e);
  }
}

// 获取字符串的字节数
export function getBitCount(str: string) {
  let count = 0;
  const arr = str.split('');
  arr.forEach((c: string) => {
    count += Math.ceil(c.charCodeAt(0).toString(2).length / 8);
  });
  return count;
}

// 调用百度翻译-同步翻译文件
// https://fanyi-api.baidu.com/doc/21
export async function getTransSourceObjByBaidu(fsPath: string, defaultLang: string, baiduAppid: string, baiduSecrectKey: string, reporter: any = null) {
  const transSourceObj = {};
  if (/\.(json)$/.test(fsPath)) {
    const data = fs.readFileSync(fsPath, 'utf-8');
    if (data) {
      const localLangObj = eval(`(${data})`);
      if (localLangObj) {
        const defaultSource = localLangObj[defaultLang];
        if (!isEmpty(defaultSource)) {
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
            const bitLen = getBitCount(text);
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
            for(let lang of langs) {
              const text2 = getTransText(transSourceObj[lang]);
              count += getBitCount(text2);
            }
            if (count > 1000) {
              vscode.window.showWarningMessage(`翻译文案过长，建议开通百度翻译账号，并在du-i18n.config.json文件中设置自己专属的baiduAppid和baiduSecrectKey`);
              // // 记录用户行为数据
							// reporter?.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
							// 	action: "在线翻译-外部",
              //   count: `字节数${count}`,
							// 	error: `翻译文案过长，建议开通百度翻译账号，并在du-i18n.config.json文件中设置自己专属的baiduAppid和baiduSecrectKey`
							// });
              return null;
            }
          }
          
          const task = async (lang: string, timeout: number) => {
            return new Promise(async (resolve, reject) => {
              try {
                const q = getTransText(transSourceObj[lang]);
                if (!q) {
                  vscode.window.showWarningMessage(`${defaultLang}的源文案不能为空！`);
                  // // 记录用户行为数据
                  // reporter?.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
                  //   action: "在线翻译-外部",
                  //   error: `${defaultLang}的源文案不能为空！`
                  // });
                  resolve(null);
                }
                const params = {
                  from: defaultLang,
                  to: lang,
                  q,
                  baiduAppid, 
                  baiduSecrectKey,
                };
                console.log('params', params);
                const data = await Baidu.getTranslate(params);
                console.log("baidu data", data);
                if (data && Array.isArray(data.trans_result)) {
                  data.trans_result.forEach(item => {
                    let key = item.src;
                    if (key) {
                      key = key.replaceAll(nt, '\n');
                      transSourceObj[lang][key] = item.dst;
                    }
                  });
                }
                if (timeout) {
                  setTimeout(() => resolve(transSourceObj), timeout);
                } else {
                  resolve(transSourceObj);
                }
              } catch(e) {
                // // 记录用户行为数据
                // reporter?.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
                //   action: "在线翻译-外部-异常",
                //   error: e,
                // });
                reject(e);
              }
            });
          };
          for(let lang of langs) {
            if (langs.length === 1) {
              await task(lang, 0);
            } else {
              await task(lang, 1000);
            }
          }
          return transSourceObj;
        }
      }
    }
  }
  return null;
}

/**
 * 处理-同步翻译
 */
export async function translateLocalFile(transSourceObj: any, defaultLang: string, tempPaths: string, filePath: string, isOverWriteLocal: boolean) {
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
              writeFileToLine(fsPath, newText);
            }
          }
        }
      } catch(e) {
        console.error(e);
      }
    }
  };
  if (!isEmpty(transSourceObj) && defaultLang) {
    if (filePath) {
      tranLocalFile(filePath);
    } else if (tempPaths) {
      const files = await getFiles(tempPaths);// 读取临时文件
      files.forEach(({ fsPath }) => {
        tranLocalFile(fsPath);
      });
    }
  }
}


/**
 * 处理-中文转译
 * @param filePath 目标文件路径
 * @param sourceData 翻译数据
 * @param translateLangs 翻译语言
 */
export async function translateFromChineseKey(filePath: string, sourceData: any, translateLangs: string[]) {
  // 根据中文key，生成对应的日文
  // 文件路径
  try {
    console.log("translateFromChineseKey", filePath);
    // 只处理vue文件
    if (/\.(vue)$/.test(filePath)) {
      handleReadStream(filePath, (data) => {
        // 判断是否存在了i18n，否则忽略
        if (data && data.indexOf('</i18n>') > -1) {
          const startIndex = data.indexOf('<i18n>') + '<i18n>'.length;
          const endIndex = data.indexOf('</i18n>', startIndex);
          const yamlStr = data.substring(startIndex, endIndex);
          // console.log("yamlStr", yamlStr);
          const yamlObj = YAML.parse(yamlStr);
          if (!yamlObj['zh']) {
            return;
          };
          (translateLangs || []).forEach(lang => {
            if (!yamlObj[lang]) {
              yamlObj[lang] = {};
            };
          });
          Object.entries(yamlObj['zh']).forEach(([k, v]: any) => {
            (translateLangs || []).forEach(lang => {
              const value = (sourceData || {})[lang][v];
              yamlObj[lang][k] = value || '';
            });
          });
          const newText = '\n' + YAML.stringify(yamlObj);
          const newStr= data.slice(0, startIndex) + newText + data.slice(endIndex);
          handleWriteStream(filePath, newStr, () => {});
        } else {
          console.log('文件不包含i18n内容，忽略处理');
        }
      });
    } else if (/\.(js|ts)$/.test(filePath)) {
      const getLangObj = (fPath, callback) => {
        handleReadStream(fPath, (data) => {
          if (data) {
            const startIndex = data.indexOf('{');
            const endIndex = data.lastIndexOf('}');
            if (startIndex < 0 || endIndex < 0) {
              return;
            }
            const dataStr = data.substring(startIndex, endIndex + 1);
            // console.log("dataStr", dataStr);
            const langObj = eval(`(${dataStr})`);
            callback(langObj);
          }
        });
      };
      // 源文件 TODO：硬编码应该读取配置
      const sourcePath = '**/i18n/locale/**';
      const files = await getFiles(sourcePath);
      console.log("files", files);
      if (!files || !files.length) {return;}
      // TODO：硬编码应该读取配置
      const zhFile: any = files.find(f => (/zh\.(js|ts)$/.test(f.fsPath)));
      if (zhFile) {
        getLangObj(zhFile.fsPath, (zhLangObj) => {
          if (zhLangObj) {
            files.forEach(({ fsPath }) => {
              const fileName = path.basename(fsPath);
              const lang = fileName.split('.')[0];
              if (lang !== 'zh') {
                getLangObj(fsPath, (langObj) => {
                  if (isEmpty(langObj)) {// 说明是新增的语言
                    const newText = Object.entries(zhLangObj).reduce((pre: any, cur: any) => {
                      const [k, v] = cur;
                      pre += (`\t'${k}': '',\n`);
                      return pre;
                    }, '');
                    const newContent = `export default {\n` + newText + '}';
                    handleWriteStream(fsPath, newContent, () => {});
                  } else if (langObj && Object.values(langObj).some(v => !v)) {// 存在空值
                    if (!sourceData || isEmpty(sourceData[lang])) {return;}
                    const newText = Object.entries(langObj).reduce((pre: any, cur: any) => {
                      const [k, v] = cur;
                      let val = v;
                      if (!v) {
                        const zhVal = zhLangObj[k];
                        const value = (sourceData || {})[lang][zhVal];
                        val = value || '';
                      }
                      if (val && val.includes("'")) {
                        pre += (`\t'${k}': "${val}",\n`);
                      } else {
                        pre += (`\t'${k}': '${val}',\n`);
                      }
                      return pre;
                    }, '');
                    const newContent = `export default {\n` + newText + '}';
                    handleWriteStream(fsPath, newContent, () => {});
                  }
                });
              }
            });
          }
        });
      }
    }
    return false;
  } catch(e) {
    console.error("translateFromChineseKey e", e);
    return false;
  }
}

export function getI18NObjectInJS(filePath: string, globalLangObj: any = {}) {
  let obj = null;
  if (filePath && /\.(js|ts)$/.test(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    const reg=/i18n\.t\([^\)]*?\)/g;
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

export function getI18NKey(keyStr: string) {
	let res = keyStr;
	res = res.split(',')[0];
	res = res.replace(/[\t\n'"]/g, '');
	return res;
}

export function isIncludePath(papa: string, child: string) {
  const papaDirs = papa.replace(/\//g, path.sep);
  const childDirs = child.replace(/\//g, path.sep);

  return papaDirs.includes(childDirs);
}