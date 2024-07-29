import * as vscode from 'vscode';
import { 
  isIncludePath,
  getFiles,
  getBaseFilePath,
  writeContentToLocalFile,
} from './index';
import * as API from './api';
const fs = require('fs');
const path = require('path');
const isEmpty = require('lodash/isEmpty');

export class DEYI {
  private configFilePath: string;
  private projectName: string;
  private projectShortName: string;
  private onlineApiUrl: string;
  private version: string;
  private transSourcePaths: string;
  private langPaths: string;
  private transSourceObj: any;
  private tempPaths: string;
  private tempFileName: string;
  private localLangFilePath: string;
  private localLangObj: any;
  private onlineLangObj: any;
  private isOverWriteLocal: any;
  private multiFolders: string[];
  private bigFileLineCount: number;
  private defaultLang: string;
  private pullLangs: string[];
  private tempLangs: string[];
  private quoteKeys: string[];
  private uncheckMissKeys: string[];
  private missCheckResultPath: string;
  private languageMissOnlinePath: string;
  private isNeedRandSuffix: boolean;
  private isSingleQuote: boolean;
  private isOnlineTrans: boolean;
  private baiduAppid: string;
  private baiduSecrectKey: string;
  private fileReg: any;
  private jsonReg: any;

  constructor(props: any = {}) {
    this.configFilePath = `/du-i18n.config.json`;// du-i18n配置文件
    this.projectName = '';// deyi项目名称
    this.projectShortName = '';// deyi项目简称
    this.onlineApiUrl = '';// 地址url
    this.version = '';// deyi版本
    this.langPaths = '**/src/i18n/locale/**';// 语言文件路径
    this.transSourcePaths = '**/src/i18n/source/**';// 翻译源文件路径
    this.tempPaths = '**/src/i18n/temp/**';// 新增翻译文案路径
    this.tempFileName = '';// 指定生成json文件名
    this.localLangFilePath = '/.language.md';// 拉取远程语言保存本地文件路径
    this.missCheckResultPath = '/.languageMissLocal.md';// 翻译漏检本地文件路径
    this.languageMissOnlinePath = '/.languageMissOnline.md';// 翻译漏检本地文件路径
    this.localLangObj = {};// 本地语言数据
    this.onlineLangObj = {};// 线上语言数据
    this.transSourceObj = {}; // key为中文的翻译源文案
    this.multiFolders = ['src', 'pages'];// 复杂文件夹
    this.defaultLang = 'zh';// 默认语言
    this.pullLangs = []; // 指定翻译扩展的语言，优先级比tempLangs高，远程不允许覆盖
    this.tempLangs = ['zh', 'en'];// 翻译扩展语言，远程的会覆盖
    this.quoteKeys = ["this.$t", "$t", "i18n.t"]; // 引用key
    this.bigFileLineCount = 1000;// 大文件行数
    this.isOverWriteLocal = false;// 是否覆盖本地已填写的翻译
    this.uncheckMissKeys = [];// 跳过翻译漏检机制的key，打标已翻译
    this.isNeedRandSuffix = true;// tempPaths下的文件是否生成文件名后缀
    this.isSingleQuote = true;// key的引用是单引号还是双引号，默认是单引号
    
    this.isOnlineTrans = true;// 本地-是否支持在线翻译
    this.baiduAppid = '';// 百度翻译appid
    this.baiduSecrectKey = '';// 百度翻译密钥

    this.fileReg = /\.(ts|js|tsx|jsx|vue|html)$/;
    this.jsonReg = /\.(json)$/;
  }
  async readConfig() {
    const files = await getFiles('**' + this.configFilePath);
    files.forEach(({ fsPath }) => {
      const fileName = path.basename(fsPath);
      if (/\.(json)$/.test(fileName)) {
        try {
          const data = fs.readFileSync(fsPath, 'utf-8');
          if (data) {
            const config = eval(`(${data})`);
            // console.log("config", config);
            const { 
              projectName, projectShortName, onlineApiUrl, version, multiFolders, 
              bigFileLineCount, pullLangs, tempLangs, defaultLang, quoteKeys, 
              transSourcePaths, tempPaths, tempFileName, isOverWriteLocal, uncheckMissKeys, 
              fileReg, isNeedRandSuffix, langPaths, isSingleQuote, 
              isOnlineTrans, baiduAppid, baiduSecrectKey
            } = config || {};
            this.projectName = projectName || this.projectName;
            this.projectShortName = projectShortName || this.projectShortName;
            this.onlineApiUrl = onlineApiUrl || this.onlineApiUrl;
            this.version = version || this.version;
            this.multiFolders = multiFolders || this.multiFolders;
            this.bigFileLineCount = bigFileLineCount || this.bigFileLineCount;
            this.pullLangs = Array.isArray(pullLangs) ? pullLangs : this.pullLangs;
            this.tempLangs = Array.isArray(tempLangs) && tempLangs.length ? tempLangs : this.tempLangs;
            this.defaultLang = defaultLang || this.tempLangs[0];
            this.quoteKeys = Array.isArray(quoteKeys) && quoteKeys.length ? quoteKeys : this.quoteKeys;
            this.transSourcePaths = transSourcePaths || this.transSourcePaths;
            this.tempPaths = tempPaths || this.tempPaths;
            this.tempFileName = tempFileName || this.tempFileName;
            this.isOverWriteLocal = !!isOverWriteLocal || this.isOverWriteLocal;
            this.uncheckMissKeys = Array.isArray(uncheckMissKeys) && uncheckMissKeys.length ? uncheckMissKeys : this.uncheckMissKeys;
            this.fileReg = fileReg || this.fileReg;
            this.isNeedRandSuffix = typeof isNeedRandSuffix === 'boolean' ? isNeedRandSuffix : this.isNeedRandSuffix;
            this.langPaths = langPaths || this.langPaths;
            this.isSingleQuote = typeof isSingleQuote === 'boolean' ? isSingleQuote : this.isSingleQuote;
            this.isOnlineTrans = typeof isOnlineTrans === 'boolean' ? isOnlineTrans : this.isOnlineTrans;
            this.baiduAppid = baiduAppid || this.baiduAppid;
            this.baiduSecrectKey = baiduSecrectKey || this.baiduSecrectKey;
          }
        } catch(e) {
          console.error(e);
        }
      }
    });
  }

  getInitConfig() {
    const initConfig = {
      quoteKeys: this.quoteKeys,
      defaultLang: this.defaultLang,
      tempLangs: this.tempLangs,
      langPaths: this.langPaths,
      transSourcePaths: this.transSourcePaths,
      tempPaths: this.tempPaths,
      tempFileName: this.tempFileName,
      multiFolders: this.multiFolders,
      uncheckMissKeys: this.uncheckMissKeys,
      isSingleQuote: this.isSingleQuote,
      isOnlineTrans: this.isOnlineTrans,
      baiduAppid: this.baiduAppid,
      baiduSecrectKey: this.baiduSecrectKey,
    };
    return initConfig;
  }

  getConfigFilePath() {
    return this.configFilePath;
  }

  getProjectName() {
    return this.projectName;
  }

  getIsOverWriteLocal() {
    return this.isOverWriteLocal;
  }

  getMissCheckResultPath() {
    return this.missCheckResultPath;
  }

  getLanguageMissOnlinePath() {
    return this.languageMissOnlinePath;
  }

  getLocalLangObj() {
    return this.localLangObj;
  }

  /**
   * 判断是否属于公司内部项目
   * 与外部无关，请忽略
   * @returns 
   */
  isOnline() {
    return this.onlineApiUrl;
  }

  getOnlineLangObj() {
    return this.onlineLangObj;
  }

  getLocalLangFilePath() {
    return this.localLangFilePath;
  }

  getQuoteKeys() {
    return this.quoteKeys;
  }

  getQuoteKeysStr() {
    if (Array.isArray(this.quoteKeys) && this.quoteKeys.length) {
      return this.quoteKeys.join(',');
    }
    return '';
  }

  getFileReg() {
    return this.fileReg;
  }

  getJsonReg() {
    return this.jsonReg;
  }

  getTempLangs() {
    return this.tempLangs;
  }

  getDefaultLang() {
    return this.defaultLang;
  }

  getTranslateLangs() {
    if (this.pullLangs && this.pullLangs.length) {
      return this.pullLangs.filter(lang => lang !== this.defaultLang);
    }
    return this.tempLangs.filter(lang => lang !== this.defaultLang);
  }

  getTempPaths() {
    return this.tempPaths;
  }

  getTransSourcePaths() {
    return this.transSourcePaths;
  }

  getTempFileName() {
    return this.tempFileName;
  }

  getProjectShortName() {
    return this.projectShortName;
  }

  getTransSourceObj() {
    return this.transSourceObj;
  }

  getBigFileLineCount() {
    return this.bigFileLineCount;
  }

  getIsNeedRandSuffix() {
    return this.isNeedRandSuffix;
  }

  getIsSingleQuote() {
    return this.isSingleQuote;
  }
  
  /**
   * 是否支持本地在线翻译，如百度翻译，默认支持
   * @returns 
   */
  getIsOnlineTrans() {
    return this.isOnlineTrans;
  }

  getLangPaths() {
    return this.langPaths;
  }

  getBaiduAppid() {
    return this.baiduAppid;
  }

  getBaiduSecrectKey() {
    return this.baiduSecrectKey;
  }

  getCurLangObj(userKey) {
    const lang = userKey || this.getDefaultLang();
    const langObj = this.isOnline() ? this.onlineLangObj : this.localLangObj;
    return langObj[lang];
  }

  async readLocalGlobalLangObj() {
    try {
      if (this.tempPaths) {
        const files = await getFiles(this.tempPaths);
        files.forEach(({ fsPath }) => {
          const fileName = path.basename(fsPath);
          if (/\.(json)$/.test(fileName)) {
            try {
              const data = fs.readFileSync(fsPath, 'utf-8');
              if (data) {
                const langObj = eval(`(${data})`);
                if (!isEmpty(langObj)) {
                  Object.entries(langObj).forEach(([lang, obj]) => {
                    if (!this.localLangObj[lang]) {
                      this.localLangObj[lang] = {};
                    }
                    const newObj: any = obj || {};
                    this.localLangObj[lang] = {
                      ...this.localLangObj[lang],
                      ...newObj,
                    };
                  });
                }
              }
            } catch(e) {
              console.error(e);
            }
          }
        });
      }
      if (this.langPaths) {
        const langFiles = await getFiles(this.langPaths);
        langFiles.forEach(({ fsPath }) => {
          const fileName = path.basename(fsPath);
          if (/\.(json)$/.test(fileName)) {
            const lang = fileName.split('.')[0];
            try {
              const data = fs.readFileSync(fsPath, 'utf-8');
              if (data) {
                const langObj = eval(`(${data})`);
                if (!isEmpty(langObj)) {
                  if (!this.localLangObj[lang]) {
                    this.localLangObj[lang] = {};
                  }
                  Object.entries(langObj).forEach(([k, v]) => {
                    this.localLangObj[lang][k] = v || this.localLangObj[lang][k] || '';
                  });
                }
              }
            } catch(e) {
              console.error(e);
            }
          }
        });
      }
    } catch(e) {
      console.error("readLocalGlobalLangObj", e);
    }
  }

  async refreshGlobalLangObj(isAll: boolean = false) {
    if (this.isOnline()) {
      // 读取在线语言库
      await this.getOnlineLanguage('', isAll);
    } else {
      // 读取全局语言包
      await this.readLocalGlobalLangObj();
    }
  }

  async openSetting(fileName: string, cb: Function) {
    const initConfigObj = this.getInitConfig();
    const configFilePath = this.getConfigFilePath();
    const configPath = await getBaseFilePath(fileName, configFilePath);
    // console.log('configPath', configPath);
    fs.access(configPath, async function (err) {
      // console.log('err', err);
      let isInit = false;
      if (err) {// 不存在
        await writeContentToLocalFile(fileName, configFilePath, initConfigObj);
        isInit = true;
      }
      vscode.workspace.openTextDocument(configPath).then((doc) => {
        vscode.window.showTextDocument(doc);
        if (isInit) {
          setTimeout(() => {
            cb(isInit);
          }, 3000);
        }
      });
    });
  }

  checkProjectConfig() {
    if (!this.projectName) {
      vscode.window.showWarningMessage('请先在du-i18n.config.json中配置得译平台对应的项目名称');
      return false;
    }
    if (!this.projectShortName) {
      vscode.window.showWarningMessage('请先在du-i18n.config.json中配置得译平台对应的项目简称');
      return false;
    }
    if (!this.onlineApiUrl) {
      vscode.window.showWarningMessage('请先在du-i18n.config.json中配置得译平台url请求地址');
      return false;
    }
    if (!this.version) {
      vscode.window.showWarningMessage('请先在du-i18n.config.json中配置得译平台对应项目的版本');
      return false;
    }
    return true;
  }

  // 设置翻译源文案
  async setTransSourceObj(cb: Function, isCheck: boolean = true) {
    let sourceData = {};
    // 源文件 
    const files = await getFiles(this.transSourcePaths);
    let inValidType = false;
    // console.log("files", files);
    files.forEach(({ fsPath }) => {
      const fileName = path.basename(fsPath);
      const lang = fileName.split('.')[0];
      if (/\.(json)$/.test(fileName)) {
        inValidType = true;
        const data = fs.readFileSync(fsPath, 'utf-8');
        if (data) {
          const obj = eval(`(${data})`);
          sourceData[lang] = {
            ...obj,
          };
        }
      }
    });
    if (this.isOnline()) {// 线上与本地合并
      if (this.defaultLang) {
        const defaultLangObj = this.onlineLangObj[this.defaultLang] || {};
        const translateLangs = this.getTranslateLangs();
        translateLangs.forEach(lang => {
          const langObj = this.onlineLangObj[lang] || {};
          const localLangObj = sourceData[lang] || {};
          const langSourceObj = {};
          Object.entries(defaultLangObj).forEach((item) => {
            const [k, v]: any = item;
            if (langObj[k]) {
              langSourceObj[v] = langObj[k];
            }
          });
          sourceData[lang] = {
            ...localLangObj,
            ...langSourceObj,
          };
        });
      }
    } else {// 本地
      if (!inValidType && isCheck) {
        const pathName = this.transSourcePaths.replace(/\*/g, '');
        vscode.window.showWarningMessage(`缺少翻译源文件，请先在${pathName}下配置翻译源文件，文件名是语言（如${pathName}CN-en.json）`);
      }
    }
    // console.log('sourceData', sourceData);
    this.transSourceObj = sourceData;
    cb(sourceData);
  }

  // 翻译漏检
  async handleMissingDetection() {
    let result = null;
    try {
      const files = await getFiles(this.tempPaths);
      if (files.length) {
        result = {};
        const defaultKeyObj = {};
        // if (this.isOnline()) {
        //   // 更新在线全局语言
        //   await this.getOnlineLanguage('', true);
        //   // 检测在线翻译情况
        //   files.forEach(({ fsPath }) => {
        //     const fileName = path.basename(fsPath);
        //     if (/\.(json)$/.test(fileName)) {
        //       const data = fs.readFileSync(fsPath, 'utf-8');
        //       if (data) {
        //         const langObj = eval(`(${data})`);
        //         if (!isEmpty(langObj)) {
        //           const newObj: any = {};
        //           const defaultLang = this.defaultLang;
        //           const defaultLangObj = this.onlineLangObj[defaultLang] || {};
        //           Object.entries(langObj).forEach(([lang, obj]) => {
        //             if (lang !== defaultLang) {
        //               // 检测key在线翻译的情况
        //               const onlinLang = this.onlineLangObj[lang] || {};
        //               // console.log('onlinLang', onlinLang);
        //               Object.keys(obj).forEach((k) => {
        //                 if (!this.uncheckMissKeys.includes(k)) {
        //                   if (!onlinLang[k]) {// 缺少翻译
        //                     if (!newObj[defaultLang]) {
        //                       newObj[defaultLang] = {};
        //                     }
        //                     if (!newObj[lang]) {
        //                       newObj[lang] = {};
        //                     }
        //                     newObj[defaultLang][k] = defaultLangObj[k];
        //                     newObj[lang][k] = onlinLang[k] || "";
        //                     defaultKeyObj[defaultLangObj[k]] = defaultLangObj[k];
        //                   }
        //                 }
        //               });
        //             }
        //           });
        //           if (!isEmpty(newObj)) {
        //             result[fileName] = newObj;
        //           }
        //         }
        //       }
        //     }
        //   });
        // } else {
          // 检测本地翻译情况
          files.forEach(({ fsPath }) => {
            const fileName = path.basename(fsPath);
            if (/\.(json)$/.test(fileName)) {
              const data = fs.readFileSync(fsPath, 'utf-8');
              if (data) {
                const langObj = eval(`(${data})`);
                if (!isEmpty(langObj)) {
                  const newObj: any = {};
                  const defaultLang = this.defaultLang;
                  const defaultLangObj = langObj[defaultLang] || {};
                  Object.entries(langObj).forEach(([lang, obj]) => {
                    if (lang !== defaultLang) {
                      Object.entries(obj).forEach(([k, v]) => {
                        if (!this.uncheckMissKeys.includes(k)) {
                          if (!v) {// 缺少翻译
                            if (!newObj[defaultLang]) {
                              newObj[defaultLang] = {};
                            }
                            if (!newObj[lang]) {
                              newObj[lang] = {};
                            }
                            newObj[defaultLang][k] = defaultLangObj[k];
                            newObj[lang][k] = v;
                            defaultKeyObj[defaultLangObj[k]] = defaultLangObj[k];
                          }
                        }
                      });
                    }
                  });
                  if (!isEmpty(newObj)) {
                    result[fileName] = newObj;
                  }
                }
              }
            }
          });
        // }

        if (!isEmpty(defaultKeyObj)) {
          result['missTranslateKeys'] = Object.keys(defaultKeyObj);
        }
      }
    } catch(e) {
      console.error("readLocalGlobalLangObj", e);
    }
    return result;
  }

  /**
   * 生成pageEnName的规则
   * 1）公共组件src/components/
   * 2）page模块中，最近一层包含components作为一个模块
   * @param filePath 
   * @returns 
   */
  generatePageEnName(filePath: string) {
    try {
      if (isIncludePath(filePath, 'src/components/')) {
        return 'src-components';
      } else {
        let dirName = path.dirname(filePath);
        let curDir = dirName.split(path.sep).slice(-1)[0];
        let lastDir = curDir;
        while(dirName && curDir && !this.multiFolders.includes(curDir)) {
          lastDir = curDir;
          const arr = dirName.split(path.sep);
          dirName = arr.slice(0, -1).join(path.sep);
          // console.log("arr", arr);
          curDir = arr[arr.length - 1];
        }
        return lastDir;
      }
    } catch (e) {
      console.log("generatePageEnName", e);
    }
    return '';
  }

  getBasePrefix(pageEnName: string) {
    if (this.projectShortName && pageEnName) {
      return `${this.projectShortName}_${pageEnName}_`;
    }
    return '';
  }

  getKeyPrefix(filePath: string) {
    let dirName = path.dirname(filePath);
    dirName = dirName.split(path.sep).slice(-1)[0];
    let fileName = path.basename(filePath);
    fileName = fileName.split('.')[0];
    let key = `${dirName}.${fileName}`;
    const rand = Date.now().toString().substr(-6);
    return `${key}.${rand}-`;
  }

  getPrefixKey(fsPath: string) {
    const pageEnName = this.generatePageEnName(fsPath);
    const basePrefix = this.getBasePrefix(pageEnName);
    const secondPrefix = this.getKeyPrefix(fsPath);
    const key = `${basePrefix}${secondPrefix}`;
    return key;
  }

  // 搜索未翻译的目标语言
  async searchUntranslateText(fromLang: string, toLang: string) {
    try {
      const onlineLangObj = this.getOnlineLangObj() || {};
      const unTranslateLangObj = {};
      const fromLangObj = onlineLangObj[fromLang];
      if (isEmpty(fromLangObj)) {
        throw new Error('数据异常');
      }
      const toLangObj = onlineLangObj[toLang] || {};
      const fromLangMap = {};
      const toLangMap = {};
      // console.log('fromLangObj', fromLangObj);
      // console.log('toLangObj', toLangObj);
      Object.entries(fromLangObj).forEach((([fromK, fromV]) => {
        if (!toLangObj[fromK]) {
          fromLangMap[fromK] = fromV;
          toLangMap[fromK] = '';
        }
      }));
      unTranslateLangObj[fromLang] = fromLangMap;
      unTranslateLangObj[toLang] = toLangMap;
      return unTranslateLangObj;
    } catch(e) {
      console.error(e);
      return null;
    }
  }

  // 搜索包含i18n的文件
  searchRepeatFilesPath(selectFolderPath: any) {
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
          if (folderPaths.includes('src')) {
            folderUrl = folderPaths.slice(folderPaths.indexOf('src')).join(path.sep);
          }
          folderUrl = '**' + path.sep + folderUrl + path.sep + '**';;
          const files = await getFiles(folderUrl);
          // console.log("files", files);
          const getPath = (fsPath) => {
            let arr = fsPath.split(path.sep);
            let filePath = fsPath;
            if (arr.includes('src')) {
              filePath = arr.slice(arr.indexOf('src')).join(path.sep);
            }
            // console.log("filePath", filePath);
            return filePath;
          };
          
          const repeatPathList = [];
          const moduleObj = {};
          const existObj = {};
          files.forEach(({ fsPath }) => {
            if (/\.(vue|jsx|tsx)$/.test(fsPath)) {
              const pageEnName = this.generatePageEnName(fsPath);
              const key = this.getPrefixKey(fsPath);
              if (!existObj[key]) {
                existObj[key] = fsPath;
              } else {
                const oldPath = getPath(existObj[key]);
                const newPath = getPath(fsPath);
                repeatPathList.push({ pageEnName, key, oldPath, newPath, fsPath });
                if (!moduleObj[pageEnName]) {
                  moduleObj[pageEnName] = [{ key, oldPath, newPath, fsPath }];
                } else {
                  moduleObj[pageEnName].push({ key, oldPath, newPath, fsPath });
                }
              }
            }
          });
          resolve({ repeatPathList, moduleObj });
        }
      } catch(e) {
        reject(e);
      }
    });
  }

  // 同步单个本地temp文件的文案到deyi平台
  async handleSyncTempFileToOnline(fsPath: string, cb: Function) {
    const pathName = (this.tempPaths || '').replace(/\*/g, '');
    if (pathName && fsPath && isIncludePath(fsPath, pathName) && this.isOnline()) {
      const fileName = path.basename(fsPath);
        // 命名规范
        let pageEnName = fileName.split('_')[0];
        if (/\.(json)$/.test(fileName)) {
          if (pageEnName.includes('.json')) {
            pageEnName = pageEnName.replace('.json', '');
          }
          try {
            const data = fs.readFileSync(fsPath, 'utf-8');
            if (data) {
              const i18nLangObj = eval(`(${data})`);
              this.handleSendToOnline(i18nLangObj, pageEnName, cb);
            }
          } catch(e) {
            console.error(e);
          }
        }
    } else {
      return vscode.window.showWarningMessage(`请在文件目录${this.tempPaths}下执行该命令`);
    }
  }

  // 批量同步本地temp文件的文案到deyi平台
  async handleSyncAllTempFileToOnline(cb: Function) {
    if (this.tempPaths && this.isOnline()) {
      const files = await getFiles(this.tempPaths);// 读取临时文件
      if (!files.length) {
        return vscode.window.showWarningMessage(`文件目录${this.tempPaths}下缺少需要同步的文案`);
      }
      files.forEach(({ fsPath }) => {
        const fileName = path.basename(fsPath);
        // 命名规范
        let pageEnName = fileName.split('_')[0];
        if (/\.(json)$/.test(fileName)) {
          if (pageEnName.includes('.json')) {
            pageEnName = pageEnName.replace('.json', '');
          }
          try {
            const data = fs.readFileSync(fsPath, 'utf-8');
            if (data) {
              const i18nLangObj = eval(`(${data})`);
              this.handleSendToOnline(i18nLangObj, pageEnName, cb);
            }
          } catch(e) {
            console.error(e);
          }
        }
      });
    }
  }

  // 同步文案到deyi平台
  async handleSendToOnline(i18nLangObj: any, pageEnName: string, cb: Function) {
    if (!this.isOnline() || !this.checkProjectConfig()) {// 校验当前配置
      return null;
    }
    try {
      if (!isEmpty(i18nLangObj)) {
        let params = {
          packageName: this.projectName,
          version: this.version,
          pageEnName,
          items: [],
        };
        const zhObj = i18nLangObj[this.defaultLang];
        const items = [];
        if (zhObj) {
          Object.entries(zhObj).forEach(([k, v]) => {
            const item = {
              displayKey: k,
              originKey: k,
              content: v,
              subscribeType: [2],
              lines: [],
            };
            const liensItem = {
              lineCode: this.defaultLang,
              content: v
            };
            item.lines.push(liensItem);
            items.push(item);
          });
  
          Object.entries(i18nLangObj).forEach(([lang, langObj]) => {
            if (lang !== this.defaultLang) {
              Object.entries(langObj).forEach(([k, v], i) => {
                const liensItem = {
                  lineCode: lang,
                  content: v
                };
                items[i].lines.push(liensItem);
              });
            }
          });
          params.items = items;
          console.log("params", params);
          this.handleUploadWords(params, () => {
            cb();
          });
        }
      }
    } catch(e) {
      console.error(e);
    }
  }

  // getI18NParams(filePath: string, repeatObj: any = null) {
  //   const pageEnName = this.generatePageEnName(filePath);
  //   console.log("pageEnName", pageEnName);
  //   const basePrefix = this.getBasePrefix(pageEnName);
  //   const secondPrefix = this.getKeyPrefix(filePath);
  //   const i18nLangObj = this.getLocalPageWords(filePath);
  //   if (!this.checkProjectConfig()) {// 校验当前配置
  //     return null;
  //   }
  //   if (!isEmpty(i18nLangObj) && basePrefix) {
  //     let params = {
  //       packageName: this.projectName,
  //       version: this.version,
  //       pageEnName,
  //       items: [],
  //     };
  //     const zhObj = i18nLangObj[this.defaultLang];
  //     const items = [];
  //     if (zhObj) {
  //       Object.entries(zhObj).forEach(([k, v]) => {
  //         let displayKey = '';
  //         if ((k || '').startsWith(`${this.projectShortName}_`)) {
  //           displayKey = k;
  //         } else {
  //           displayKey = basePrefix;
  //           // console.log("secondPrefix", k, secondPrefix);
  //           if (secondPrefix && k && !k.includes(secondPrefix)) {
  //             // console.log("secondPrefix2", k, secondPrefix);
  //             displayKey += secondPrefix;
  //             // if (repeatObj && repeatObj[pageEnName]) {
  //             //   const index = repeatObj[pageEnName].findIndex(({ fsPath }) => fsPath === filePath);
  //             //   if (index > -1) {
  //             //     displayKey += `${index}.`;
  //             //   }
  //             // }
  //           }
  //           displayKey += k;
  //         }
  //         const item = {
  //           displayKey,
  //           originKey: k,
  //           content: v,
  //           subscribeType: [2],
  //           lines: [],
  //         };
  //         const liensItem = {
  //           lineCode: this.defaultLang,
  //           content: v
  //         };
  //         item.lines.push(liensItem);
  //         items.push(item);
  //       });

  //       Object.entries(i18nLangObj).forEach(([lang, langObj]) => {
  //         if (lang !== this.defaultLang) {
  //           Object.entries(langObj).forEach(([k, v], i) => {
  //             const liensItem = {
  //               lineCode: lang,
  //               content: v
  //             };
  //             items[i].lines.push(liensItem);
  //           });
  //         }
  //       });
  //       params.items = items;
  //       console.log("getI18NParams", params);
  //       return params;
  //     }
  //   }
  //   return null;
  // }

  async handleUploadWords(params: any, cb: Function) {
    try {
      if (params) {
        const limitNum = 100;
        const { items=[] } = params;
        let itemList = [];
        for(let i = 0; i < items.length; i+= limitNum) {
          itemList.push(items.slice(i, i+limitNum));
        }
        if (itemList.length && this.onlineApiUrl) {
          // console.log("itemList", itemList);
          const taskList = itemList.reduce((pre, cur, i) => {
            let url = this.onlineApiUrl + '/batch-add';
            const newParams = {
              ...params,
              items: cur || []
            };
            const task = this.request(url, newParams, 'post');
            pre.push(task);
            return pre;
          }, []);
          const res = await Promise.all(taskList);
          console.log("res1", res);
          const res2:any = await this.queryPageWords(params.pageEnName);
          if (res2.code === 200 && res2.data) {
            console.log("res2", res2);
            if (Array.isArray(res2.data)) {
              const { content } = res2.data[0] || {};
              cb(content);
            }
          }
        }
      }
    } catch(e) {
      console.error(e);
      return null;
    }
  }

  // async handleSingleAdd(filePath: string, repeatObj: any = null) {
  //   try {
  //     const params = this.getI18NParams(filePath, repeatObj);
  //     if (params) {
  //       const limitNum = 100;
  //       const { items=[] } = params;
  //       let itemList = [];
  //       let keyMap = {};// 本地key与平台key的映射关系
  //       items.forEach(({ originKey:k, displayKey:v }) => {
  //         if (k !== v) {
  //           keyMap[k] = v;
  //         }
  //       });
  //       if (isEmpty(keyMap)) { return; }// 没有新增
  //       for(let i = 0; i < items.length; i+= limitNum) {
  //         itemList.push(items.slice(i, i+limitNum));
  //       }
  //       if (itemList.length && this.onlineApiUrl) {
  //         // console.log("itemList", itemList);
  //         const taskList = itemList.reduce((pre, cur, i) => {
  //           let url = this.onlineApiUrl + '/batch-add';
  //           const newParams = {
  //             ...params,
  //             items: cur || []
  //           };
  //           const task = this.request(url, newParams, 'post');
  //           pre.push(task);
  //           return pre;
  //         }, []);
  //         const res = await Promise.all(taskList);
  //         console.log("res1", res);
  //         const res2:any = await this.queryPageWords(filePath, params.pageEnName);
  //         if (res2.code === 200 && res2.data) {
  //           console.log("res2", res2);
  //           if (Array.isArray(res2.data)) {
  //             const { content } = res2.data[0] || {};
  //             await this.replaceLocalI18N(filePath, content, keyMap);
  //           }
  //         }
  //         {return res;}
  //       }
  //     }
  //   } catch(e) {
  //     console.error(e);
  //     return null;
  //   }
  // }

  // async handleBatchAdd(selectFolderPath: any) {
  //   try {
  //     if (!selectFolderPath) {return;}
  //     // const repeat: any = await this.searchRepeatFilesPath(selectFolderPath);
  //     // const repeatObj = repeat.moduleObj || null;
  //     const folderPaths = selectFolderPath.split(path.sep);
  //     // console.log("folderPaths", folderPaths);
  //     const len = folderPaths.length;
  //     if (len) {
  //       let folderUrl = folderPaths[len - 1];
  //       if (folderPaths.includes('src')) {
  //         folderUrl = folderPaths.slice(folderPaths.indexOf('src')).join(path.sep);
  //       }
  //       folderUrl = '**' + path.sep + folderUrl + path.sep + '**';;
  //       const files = await getFiles(folderUrl);
  //       // console.log("files", files);
  //       for(let file of files) {
  //         await this.handleSingleAdd(file.fsPath);
  //       }
  //     }
  //   } catch(e) {
  //     console.error("handleBatchAdd e", e);
  //   }
  // }

  async queryPageWords(pageEnName: string, callback: Function = null) {
    const params = {
      packageName: this.projectName,
      version: this.version,
      pageEnName,
      items: [],
    };
    if (this.projectName && pageEnName && this.onlineApiUrl) {
      const url = this.onlineApiUrl + '/query-by-page';
      const res = await this.request(url, params);
      return res;
    }
    return null;
  }

  // 查询在线文案
  async queryLangWords(lang: string, isAll: boolean) {
    const requestSingleLang = async (areaLang, isInit=false) => {
      const params = {
        projectCode: this.projectName,
        version: this.version,
        currentAreaLang: areaLang,
        useKeyContentIfTranslateIsBlank: false,
      };
      // console.log('queryLangWords', this.projectName, this.onlineApiUrl);
      if (this.projectName && this.onlineApiUrl) {
        const url = this.onlineApiUrl + '/query-by-package';
        // console.log("url", url);
        const { data=null }: any = await this.request(url, params);
        console.log("data", data);
        if (data) {
          // 默认拉取所有语言，用户也可配置拉取制定的语言集合this.pullLangs
          if (isInit && Array.isArray(data.areaLangs)) {
            console.log("data.areaLangs", data.areaLangs);
            // 重新设置语言keys
            this.tempLangs = data.areaLangs.map(item => item.code);
            if (isAll) {
              for(let item of data.areaLangs) {
                if (Array.isArray(this.pullLangs) && this.pullLangs.length) {
                  if (this.pullLangs.includes(item.code)) {
                    await requestSingleLang(item.code);
                  }
                } else {
                  if (item.code) {// 递归循环调用
                    await requestSingleLang(item.code);
                  }
                }
              }
            }
          }
          if (Array.isArray(data.list)) {
            const langMap = data.list.reduce((pre, cur) => {
              if (cur && cur.content) {
                Object.assign(pre, cur.content);
              }
              return pre;
            }, {});
            // console.log('langMap', langMap);
            this.onlineLangObj[areaLang] = langMap;
          }
        }
      }
    };
    await requestSingleLang(lang, true);
  }

  async getOnlineLanguage(lang: string = '', isAll = false) {
    const areaLang = lang || this.defaultLang;
    await this.queryLangWords(areaLang, isAll);
  }

  request(url, params, method = 'get') {
    // return new Promise((resolve, reject) => {
    //   resolve(null);
    // });
    return new Promise((resolve, reject) => {
      if (method === 'get') {
        API.GET(url, params).then((res) => {
          resolve(res);
        }).catch(e => {
          console.log('e', e);
          reject(e);
        });
      } else {
        API.POST(url, params).then((res) => {
          resolve(res);
        }).catch(e => {
          console.log('e', e);
          reject(e);
        });
      }
    });
  }
  
  async init(context: vscode.ExtensionContext, cb: Function) {
    // 读取配置并设置
    await this.readConfig();
    // 更新全局语言库
    await this.refreshGlobalLangObj(true);
    // console.log('this.onlineLangObj', this.onlineLangObj);
    cb();
  }
}
