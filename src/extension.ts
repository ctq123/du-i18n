import * as vscode from 'vscode';
// import TelemetryReporter from "vscode-extension-telemetry";
import { 
	getObjectValue, 
	writeJsonFileSync, 
	handleScanFileInner, 
	writeYmlFileSync,
	getFiles,
	showDecoration,
	openConfigCommand,
	getRegExp,
	getStringValue,
	handleScanAndInit,
	handleMultiTranslateFromChineseKey,
	handleReadStream,
	handleAnalystics,
	ananlysisLocalGlobal,
	writeContentToLocalFile,
	translateLocalFile,
	writeIntoTempFile,
	getBaseFilePath,
	generateLangFile,
	getTransSourceObjByBaidu,
	isIncludePath,
	getProjectInfo,
	limitedParallelRequests,
} from './utils';
import { DEYI } from './utils/deyi';
const fs = require('fs');
const path = require('path');
const isEmpty = require('lodash/isEmpty');
import * as packageJson from "../package.json";

import { ViewLoader } from './view/ViewLoader';

interface LangType {
	defaultKey: string;
	language: object;
	langFilePath?: object;
	filePath?: string;
	type?: string;
};

let langObj: LangType = null;
let userKey: string = '';
let timeout: any = null;

/**
 * 判断当前文档是否包含i18n的引用
 * @param str 
 * @param keys 
 * @returns 
 */
function checkText(str: string, keys: string) {
	const list = keys.replace(/\s/g, '').replace(',', '(,').split(',');
	return list.some(t => t !== '(' && str.indexOf(t) > -1);
}

function getI18NKey(keyStr: string) {
	let res = keyStr;
	res = res.split(',')[0];
	res = res.replace(/[\t\n'"]/g, '');
	return res;
}

function getKeyPosition(text: any, keys: string) {
	const positionObj: any = {};// key: 左括号位置+右括号位置，value: i18n的字符串
	if (keys && text) {
		keys.split(',').forEach((k) => {
			const key = (k || '').trim() + '(';
			let index = -1, startIndex = 0;
			while((index = text.indexOf(key, startIndex)) > -1) {
				const leftCol = index + key.length;// 左括号位置
				const rightCol = text.indexOf(')', leftCol);// 右括号位置
				if (rightCol > -1) {
					const value = getI18NKey(text.substring(leftCol, rightCol));
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
 * 渲染文档，添加标签
 * @param includeKeys 
 */
function renderDecoration(deyi: DEYI) {
	const activeEditor = vscode.window.activeTextEditor;
	// console.log("lang", lang)
	const langObj = deyi.getCurLangObj(userKey);
	if (activeEditor && !isEmpty(langObj)) {
		// console.log('langObj', langObj);
		const { fileName, getText } = activeEditor.document || {};
		const contentText = getText ? getText() : '';
		const quoteKeysStr = deyi.getQuoteKeysStr();
		const fileReg = deyi.getFileReg();
		// 判断当前文档是否包含i18n的引用
		if (quoteKeysStr && fileReg.test(fileName) && checkText(contentText, quoteKeysStr)) {
			const positionObj = getKeyPosition(contentText, quoteKeysStr);
			// console.log("positionObj", positionObj);
			triggerUpdateDecorations(activeEditor, positionObj, langObj);
		}
	}
}

function triggerUpdateDecorations(activeEditor, positionObj, langObj) {
  if (timeout) {
    clearTimeout(timeout);
  }
  timeout = setTimeout(() => showDecoration(activeEditor, positionObj, langObj), 300);
}

export async function activate(context: vscode.ExtensionContext) {
	try {
		const deyi = new DEYI();
		// console.log("deyi", deyi);

		const proInfo = getProjectInfo();
		const projectInfo = JSON.stringify(proInfo);

		// 初始化
		deyi.init(context, () => {
			// 渲染语言
			renderDecoration(deyi);
			console.log("deyi init complete");
			// try {
			// 	// 记录用户行为数据，只会读取package.json文件信息中的（项目名称、版本、项目描述），其余内容不会读取
			// 	reporter.sendTelemetryEvent("du_i18n_deyi_init", {
			// 		action: "初始化",
			// 		projectInfo,
			// 	});
			// } catch(e) {}
		});

		// 监听文件保存
		vscode.workspace.onDidSaveTextDocument(
			async (document) => {
				let activeEditor = vscode.window.activeTextEditor;
				if (activeEditor && activeEditor.document === document) {
					const fileName = activeEditor.document.fileName;	
					const fileReg = deyi.getFileReg();
					const jsonReg = deyi.getJsonReg();			
					if (jsonReg.test(fileName)) {// 需要扩展
						let transSourcePaths = deyi.getTransSourcePaths();
						transSourcePaths = transSourcePaths.replace(/\*/g, '');
						// console.log('transSourcePaths', fileName, transSourcePaths);
						if (isIncludePath(fileName, transSourcePaths)) {
							// console.log('setTransSourceObj');
							// 更新翻译源
							await deyi.setTransSourceObj(() => {}, false);
						}
						const configFilePath = deyi.getConfigFilePath();
						if (isIncludePath(fileName, configFilePath)) {
							deyi.init(context, () => {});
							console.log("deyi2", deyi);
						}
					}
					if (fileReg.test(fileName)) {
						// 渲染语言
						renderDecoration(deyi);
					}
				}
			},
			null,
			context.subscriptions
		);

		// 监听活动文件窗口
		vscode.window.onDidChangeActiveTextEditor(async editor => {
			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor && activeEditor.document === editor?.document) {
				// 扫描内部特殊引用方式
				// await scanInnerFile();
				// 渲染语言
				renderDecoration(deyi);
				// discard: 对接多语言平台api已废弃，先去掉耗性能
				// // 多语言平台
				// onlineOnDidChangeActiveTextEditor();
			}
		});

		// 监听命令-扫描中文
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.scanAndGenerate', 
			async function () {
				// console.log("vscode 扫描中文")
				try {
					// // 记录用户行为数据
					// reporter.sendTelemetryEvent("extension_du_i18n_scanAndGenerate", {
					// 	action: "扫描中文",
					// 	projectInfo,
					// });

					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor) {
						const { fileName } = activeEditor.document || {};
						const initLang = deyi.getTranslateLangs();
						const keys = deyi.getQuoteKeys();
						const defaultLang = deyi.getDefaultLang();
						const prefixKey = deyi.getPrefixKey(fileName);
						const tempPaths = deyi.getTempPaths();
						const pageEnName = deyi.generatePageEnName(fileName);
						const tempFileName = deyi.getTempFileName();
						const isNeedRandSuffix = deyi.getIsNeedRandSuffix();
						const isSingleQuote = deyi.getIsSingleQuote();
						const keyBoundaryChars = deyi.getKeyBoundaryChars();
						const handleRefresh = async () => {
							await deyi.refreshGlobalLangObj();
							renderDecoration(deyi);
						};
						handleScanAndInit(fileName, initLang, keys, defaultLang, prefixKey, isSingleQuote, keyBoundaryChars, (newLangObj) => {
							if (!isEmpty(newLangObj)) {
								writeIntoTempFile(tempPaths, fileName, newLangObj, pageEnName, tempFileName, isNeedRandSuffix, async () => {
									if (deyi.isOnline()) {
										deyi.handleSendToOnline(newLangObj, pageEnName, async () => {
											handleRefresh();

											// // 记录用户行为数据
											// reporter.sendTelemetryEvent("extension_du_i18n_scanAndGenerate", {
											// 	action: "扫描中文-内部-成功",
											// });
										});
									} else {
										handleRefresh();

										// // 记录用户行为数据
										// reporter.sendTelemetryEvent("extension_du_i18n_scanAndGenerate", {
										// 	action: "扫描中文-外部-成功",
										// });
									}
								});
							}
						});
					}
				} catch(e) {
					console.error("scanAndGenerate e", e);
					// // 记录用户行为数据
					// reporter.sendTelemetryEvent("extension_du_i18n_scanAndGenerate", {
					// 	action: "扫描中文-异常",
					// 	projectInfo,
					// 	error: e
					// });
				}
			})
		);

		// 监听命令-批量扫描中文
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.multiScanAndGenerate', 
			async function () {
				try {
					// // 记录用户行为数据
					// reporter.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
					// 	action: "批量扫描中文",
					// 	projectInfo,
					// });
					// console.log("vscode 批量扫描中文")
					const selectFolder = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, });
					// console.log("selectFolder", selectFolder);
					if (!selectFolder || !selectFolder[0] || !selectFolder[0].path) {return;}
					const folderPath = selectFolder[0].path;
					const initLang = deyi.getTranslateLangs();
					const keys = deyi.getQuoteKeys();
					const isSingleQuote = deyi.getIsSingleQuote();
					const defaultLang = deyi.getDefaultLang();
					const tempPaths = deyi.getTempPaths();
					const folderPaths = folderPath.replace(/\//g, path.sep).split(path.sep);
					// console.log("folderPath", folderPath, path.sep);
					// console.log("folderPaths", folderPaths);
					const len = folderPaths.length;
					if (len) {
						let folderUrl = folderPaths[len - 1];
						if (folderPaths.includes('src')) {
							folderUrl = folderPaths.slice(folderPaths.indexOf('src')).join(path.sep);
						}
						folderUrl = '**' + path.sep + folderUrl + path.sep + '**';
						console.log("folderUrl", folderUrl);
						const files = await getFiles(folderUrl);
						console.log("files", files);
						const handleRefresh = async () => {
							await deyi.refreshGlobalLangObj();
							renderDecoration(deyi);
						};
						files.forEach((file, i) => {
							const fileName = file.fsPath;
							const prefixKey = deyi.getPrefixKey(fileName, i.toString());
							const pageEnName = deyi.generatePageEnName(fileName);
							const tempFileName = deyi.getTempFileName();
							const isNeedRandSuffix = deyi.getIsNeedRandSuffix();
							const keyBoundaryChars = deyi.getKeyBoundaryChars();
							
							handleScanAndInit(fileName, initLang, keys, defaultLang, prefixKey, isSingleQuote, keyBoundaryChars, (newLangObj) => {
								if (!isEmpty(newLangObj)) {
									writeIntoTempFile(tempPaths, fileName, newLangObj, pageEnName, tempFileName, isNeedRandSuffix, async () => {
										if (deyi.isOnline()) {
											deyi.handleSendToOnline(newLangObj, pageEnName, async () => {
												if (i === files.length - 1) {
													handleRefresh();

													// // 记录用户行为数据
													// reporter.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
													// 	action: "批量扫描中文-内部-成功",
													// });
												}
											});
										} else {
											if (i === files.length - 1) {// TODO: 这里其实用promise.all更好，但改造多层回调成本太大，暂且这样
												handleRefresh();

												// // 记录用户行为数据
												// reporter.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
												// 	action: "批量扫描中文-外部-成功",
												// });
											}
										}
									});
								}
							});
						});
					}
				} catch(e) {
					console.error("multiScanAndGenerate e", e);
					// // 记录用户行为数据
					// reporter.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
					// 	action: "批量扫描中文-异常",
					// 	projectInfo,
					// 	error: e
					// });
				}
			})
		);

		// 监听命令-在线翻译
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.translateFromChineseKey', 
			async function () {
				try {
					// // 记录用户行为数据
					// reporter.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
					// 	action: "在线翻译",
					// 	projectInfo,
					// });

					// console.log("vscode 中文转译")
					const langKey = userKey || deyi.getDefaultLang();
					const tempPaths = deyi.getTempPaths();
					const isOverWriteLocal = deyi.getIsOverWriteLocal();

					const handleTranslate = async (sourObj: any = {}, filePath: string = '') => {
						// console.log("transSourceObj", transSourceObj);
						await translateLocalFile(sourObj, langKey, tempPaths, filePath, isOverWriteLocal);
						if (!deyi.isOnline()) {
							await deyi.refreshGlobalLangObj();
						}
						// // 记录用户行为数据
						// reporter.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
						// 	action: "在线翻译-成功",
						// });
					};
					if (deyi.isOnline()) {
						const transSourceObj = deyi.getTransSourceObj();
						// console.log('transSourceObj', transSourceObj);
						if (isEmpty(transSourceObj)) {
							await deyi.setTransSourceObj((data) => {
								handleTranslate(data);
							});
						} else {
							handleTranslate(transSourceObj);
						}
						// // 记录用户行为数据
						// reporter.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
						// 	action: "在线翻译-内部",
						// });
					} else {// 调用百度翻译
						if (this.getIsOnlineTrans() === false) {
							if (!deyi.getBaiduAppid() || !deyi.getBaiduSecrectKey()) {
								vscode.window.showWarningMessage(`请先配置百度翻译key，地址详情https://fanyi-api.baidu.com/doc/21`);
								return;
							}
						}
						
						const activeEditor = vscode.window.activeTextEditor;
						if (activeEditor) {
							const { fileName } = activeEditor.document || {};
							const tempPaths = deyi.getTempPaths();
							const tempPathName = tempPaths.replace(/\*/g, '');
							// console.log('fileName', fileName, tempPathName);
							if (fileName && isIncludePath(fileName, tempPathName) && /\.(json)$/.test(fileName)) {
								const baiduAppid = deyi.getBaiduAppid();
								const baiduSecrectKey = deyi.getBaiduSecrectKey();
								if (!/\.(json)$/.test(fileName)) {return;}
								const data = fs.readFileSync(fileName, 'utf-8');
								if (!data) {return;}
								const localLangObj = eval(`(${data})`);
								// 调用百度翻译
								const transSourceObj = await getTransSourceObjByBaidu(localLangObj, langKey, baiduAppid, baiduSecrectKey, isOverWriteLocal);
								// console.log('transSourceObj', transSourceObj);
								if (!isEmpty(transSourceObj)) {
									handleTranslate(transSourceObj, fileName);
								}
							} else {
								vscode.window.showWarningMessage(`请到目录${tempPaths}的翻译文件中调用该命令`);
								
								// // 记录用户行为数据
								// reporter.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
								// 	action: "在线翻译-外部",
								// 	error: `请到目录${tempPaths}的翻译文件中调用该命令`
								// });
							}
						}
					}
				} catch(e) {
					// // 记录用户行为数据
					// reporter.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
					// 	action: "在线翻译-异常",
					// 	projectInfo,
					// 	error: e,
					// });
				}
			})
		);

		// 监听命令-批量在线翻译
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.multiTranslateFromChineseKey', 
			async function () {
				try {
					// console.log("vscode 中文转译")
					const langKey = userKey || deyi.getDefaultLang();
					const tempPaths = deyi.getTempPaths();
					const isOverWriteLocal = deyi.getIsOverWriteLocal();

					const handleTranslate = async (sourObj: any = {}, filePath: string = '') => {
						// console.log("transSourceObj", transSourceObj);
						await translateLocalFile(sourObj, langKey, tempPaths, filePath, isOverWriteLocal);
						if (!deyi.isOnline()) {
							await deyi.refreshGlobalLangObj();
						}
					};
					if (deyi.isOnline()) {
						const transSourceObj = deyi.getTransSourceObj();
						// console.log('transSourceObj', transSourceObj);
						if (isEmpty(transSourceObj)) {
							await deyi.setTransSourceObj((data) => {
								handleTranslate(data);
							});
						} else {
							handleTranslate(transSourceObj);
						}
						// // 记录用户行为数据
						// reporter.sendTelemetryEvent("extension_du_i18n_multiScanAndGenerate", {
						// 	action: "在线翻译-内部",
						// });
					} else {// 批量调用百度翻译
						const baiduAppid = deyi.getBaiduAppid();
						const baiduSecrectKey = deyi.getBaiduSecrectKey();
						if (!baiduAppid || !baiduSecrectKey) {
							vscode.window.showWarningMessage(`批量翻译，请开通百度翻译账号，并在du-i18n.config.json文件中设置自己专属的baiduAppid和baiduSecrectKey`);
							return;
						}

						// 返回没有翻译的文件集合
						const resultObj: any = await deyi.handleMissingDetection('filePath');

						const requestList = Object.entries(resultObj).map(([key, value]) => {
						  const fileName = key;
						  const transObj = value;
							const task = async () => {
									// 调用百度翻译
									try {
										const transSourceObj = await getTransSourceObjByBaidu(transObj, langKey, baiduAppid, baiduSecrectKey, isOverWriteLocal);
										if (!isEmpty(transSourceObj)) {
											handleTranslate(transSourceObj, fileName);
											return { code: 200, transSourceObj };
										} else {
											return { code: 500, message: '翻译失败' };
										}
									} catch(e) {
										console.error('e', e);
										return { code: 500, message: e.message };
									}
							};
							return task;
						});
						
						limitedParallelRequests(requestList, 1).then((result) => {
							console.log('result', result);
							if (Array.isArray(result) && result.every(item => item.code === 200)) {
								vscode.window.showInformationMessage(`翻译完成，请检查文件`);
							}
						});
					}
				} catch(e) {
					console.error('e', e);
				}
			})
		);

		// 设置
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.setting', 
			async function () {
				// openConfigCommand();
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor) {
					const { fileName } = activeEditor.document || {};
					deyi.openSetting(fileName, (isInit) => {
						if (isInit) {
							deyi.init(context, () => {});
							console.log("deyi2", deyi);
							// // 记录用户行为数据
							// reporter.sendTelemetryEvent("du_i18n_deyi_init", {
							// 	action: "初始化-设置回调",
							// 	projectInfo,
							// });
						}
					});
				}

				// // 记录用户行为数据
				// reporter.sendTelemetryEvent("extension_du_i18n_setting", {
				// 	action: "设置",
				// });
			})
		);

		// 监听命令-切换显示语言
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.change', 
			async function () {
				// 多语言平台
				const defaultLang = deyi.getDefaultLang();
				const tempLangs = deyi.getTempLangs();
				const langKey = userKey || defaultLang;
				if (Array.isArray(tempLangs) && tempLangs.length) {
					const items = tempLangs.map((k) => ({ label: k, value: k }));
					const selected = await vscode.window.showQuickPick(items, { placeHolder: langKey });
					if (selected && selected.value !== userKey) {
						userKey = selected.value;
						if (deyi.isOnline()) {
							await deyi.getOnlineLanguage(userKey);
						}
						// 重新渲染
						renderDecoration(deyi);
					}
				}
				// // 记录用户行为数据
				// reporter.sendTelemetryEvent("extension_du_i18n_change", {
				// 	action: "切换语言",
				// });
			})
		);

		// 监听自定义命令-用于接收下一层返回的数据并进行处理
		context.subscriptions.push(vscode.commands.registerCommand(
			'extension.du.i18n.receive', 
			async function (event) {
				console.log("registerCommand callback extension.du.i18n.receive", event);
				if (event) {
					switch(event.type) {
						case 'READY':// 渲染完成，可以传递参数
							const { defaultKey, language={}, type } = langObj || {};
							const langKey = userKey || defaultKey;
							const payload = {
								defaultLang: langKey,
								langs: Object.keys(language),
								defaultFormat: type
							};
							ViewLoader.postMessageToWebview({
								type: 'TRANSLATE-POST',
								payload,
							});
							break;

						case 'TRANSLATE-WRITE':// 写入文件
							const data = event.payload || {};
							if (data.lang) {
								const { langFilePath={}, filePath, type } = langObj || {};
								const fsPath = langFilePath[data.lang] || filePath;
								if (fsPath && data.text) {
									if (type === 'yaml') {
										if (writeYmlFileSync(fsPath, data.lang, data.text)) {
											return ViewLoader.postMessageToWebview({
												type: 'TRANSLATE-SHOWMSG',
												payload: true,
											});
										}
									} else {
										if (writeJsonFileSync(fsPath, data.text)) {
											return ViewLoader.postMessageToWebview({
												type: 'TRANSLATE-SHOWMSG',
												payload: true,
											});
										}
									}
								}
							}
							return ViewLoader.postMessageToWebview({
								type: 'TRANSLATE-SHOWMSG',
								payload: false,
							});
					}
				}
				// // 记录用户行为数据
				// reporter.sendTelemetryEvent("extension_du_i18n_receive", {
				// 	action: "自定义命令",
				// });
			})
		);

		// 监听命令-批量新增
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.add', 
			async function () {
				ViewLoader.showWebview(context);
			})
		);
		
		// discard: 用处不大，先去掉耗性能
		// // 监听命令-处理点击转跳到变量声明处
		// context.subscriptions.push(vscode.languages.registerDefinitionProvider(languageIds, {
		// 	provideDefinition
		// }));

		// 监听命令-刷新
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.updateLocalLangPackage', 
			async function () {
				await deyi.refreshGlobalLangObj(true);
				// 重新渲染
				renderDecoration(deyi);
				vscode.window.showInformationMessage(`翻译数据刷新成功`);

				// // 记录用户行为数据
				// reporter.sendTelemetryEvent("extension_du_i18n_updateLocalLangPackage", {
				// 	action: "刷新数据",
				// });
			})
		);
		// 监听命令-文件统计
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.analytics', 
			async function () {
				const selectFolder = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, });
				// console.log("selectFolder", selectFolder);
				if (!selectFolder || !selectFolder[0] || !selectFolder[0].path) {return;}
				const result: any = await handleAnalystics(selectFolder[0].path, deyi.getBigFileLineCount());
				console.log("result", result);
				const panel = vscode.window.createWebviewPanel(
					'analyticsResult',
					'分析与统计-结果',
					vscode.ViewColumn.Two,
					{}
				);
				// 设置HTML内容
				let str = ``;
				if (result && !isEmpty(result.fileTypeObj)) {
					str += `文件统计（类型/个数）：<br/>\n`;
					str += Object.entries(result.fileTypeObj).map(([k, v]) => (k + ' ' + v)).join('\n<br/>\n');
					str += '\n<br/>';
					str += ('文件总数：' + Object.values(result.fileTypeObj).reduce((pre: any, v: any) => (pre + v), 0) + '\n<br/>\n');
					str += '\n<br/>\n<br/>';
					str += `index文件（类型/个数）：<br/>\n`;
					str += Object.entries(result.indexFileObj).map(([k, v]) => (k + ' ' + v)).join('\n<br/>\n');
					str += Object.keys(result.indexFileObj).length ? '' : '无';
					str += '\n<br/>\n<br/>\n<br/>';
					str += `大文件统计（路径/行数）：<br/>\n`;
					if (!isEmpty(result.bigFileList)) {
						result.bigFileList.forEach((item: any) => {
							str += `${item.path}   ${item.count}`;
							str += '<br/>\n';
						});
					} else {
						str += `无\n`;
					}
					panel.webview.html = str;
				} else {
					panel.webview.html = `暂无数据`;
				}

				// // 记录用户行为数据
				// reporter.sendTelemetryEvent("extension_du_i18n_analytics", {
				// 	action: "文件统计",
				// });
			})
		);

		// 监听命令-上传文案
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.updateLocalToOnline', 
			async function () {
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor) {
					const { fileName } = activeEditor.document || {};
					if (deyi.isOnline()) {
						deyi.handleSyncTempFileToOnline(fileName, () => {
							deyi.getOnlineLanguage();
							vscode.window.showInformationMessage(`当前文件上传成功`);
							// // 记录用户行为数据
							// reporter.sendTelemetryEvent("extension_du_i18n_updateLocalToOnline", {
							// 	action: "上传文案-内部-成功上传",
							// });
						});
						// // 记录用户行为数据
						// reporter.sendTelemetryEvent("extension_du_i18n_updateLocalToOnline", {
						// 	action: "上传文案-内部",
						// });
					} else {
						vscode.window.showWarningMessage(`请完善线上化相关配置`);
						const activeEditor = vscode.window.activeTextEditor;
						if (activeEditor) {
							const { fileName } = activeEditor.document || {};
							deyi.openSetting(fileName, () => {});
						}
						// // 记录用户行为数据
						// reporter.sendTelemetryEvent("extension_du_i18n_updateLocalToOnline", {
						// 	action: "上传文案-外部",
						// });
					}
				}
			})
		);

		// 监听命令-批量上传文案
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.batchUpdateLocalToOnline', 
			async function () {
				if (deyi.isOnline()) {
					deyi.handleSyncAllTempFileToOnline(() => {
						deyi.getOnlineLanguage();
						vscode.window.showInformationMessage(`同步成功`);
						// // 记录用户行为数据
						// reporter.sendTelemetryEvent("extension_du_i18n_batchUpdateOnline", {
						// 	action: "批量上传文案-内部成功上传",
						// });
					});
					// // 记录用户行为数据
					// reporter.sendTelemetryEvent("extension_du_i18n_batchUpdateOnline", {
					// 	action: "批量上传文案-内部",
					// });
				} else {
					vscode.window.showWarningMessage(`请完善线上化相关配置`);
					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor) {
						const { fileName } = activeEditor.document || {};
						deyi.openSetting(fileName, () => {});
					}
					// // 记录用户行为数据
					// reporter.sendTelemetryEvent("extension_du_i18n_batchUpdateOnline", {
					// 	action: "批量上传文案-外部",
					// });
				}
				// const selectFolder = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, });
				// // console.log("selectFolder", selectFolder);
				// if (!selectFolder || !selectFolder[0] || !selectFolder[0].path) {return;}
				// await deyi.handleBatchAdd(selectFolder[0].path);
				// handleRefresh();
			})
		);

		// 监听命令-拉取远程文案
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.updateLocalFromOnline', 
			async function () {
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor) {
					const { fileName } = activeEditor.document || {};
					if (deyi.isOnline()) {
						// // 记录用户行为数据
						// reporter.sendTelemetryEvent("extension_du_i18n_updateLocalFromOnline", {
						// 	action: "拉取远程文案-内部",
						// });

						if (!deyi.checkProjectConfig()) {
							return null;
						}
						await deyi.getOnlineLanguage();
						const onlineLangObj = deyi.getOnlineLangObj();
						const localFilePath = deyi.getLocalLangFilePath();
						const filePath: any = await writeContentToLocalFile(fileName, localFilePath, onlineLangObj);
						// 设置HTML内容
						if (filePath) {
							vscode.workspace.openTextDocument(filePath).then((doc) => {
								vscode.window.showTextDocument(doc);

								// // 记录用户行为数据
								// reporter.sendTelemetryEvent("extension_du_i18n_updateLocalFromOnline", {
								// 	action: "拉取远程文案-内部-成功拉取",
								// });
							});
						}
					} else {
						vscode.window.showWarningMessage(`请完善线上化相关配置`);
						deyi.openSetting(fileName, () => {});
						// // 记录用户行为数据
						// reporter.sendTelemetryEvent("extension_du_i18n_updateLocalFromOnline", {
						// 	action: "拉取远程文案-外部",
						// });
					}
				}
			})
		);

		// 监听命令-翻译漏检
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.missingDetection', 
			async function () {
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor) {
					const { fileName } = activeEditor.document || {};
					const missCheckResultPath = deyi.getMissCheckResultPath();
					const result: any = await deyi.handleMissingDetection();
					console.log("result", result);
					let str = `翻译漏检-结果：\n`;
					if ((!isEmpty(result))) {
						const missTranslateKeys = result.missTranslateKeys;
						delete result.missTranslateKeys;
						str += missTranslateKeys.join('\n');
						str += '\n\n';
						str += '详情如下：\n';
						str += JSON.stringify(result, null, '\t');
					} else if (result !== null) {
						str += `太棒了，已全部翻译完成！！！`;
					} else {
						str += `无翻译数据`;
					}
					const filePath: any = await writeContentToLocalFile(fileName, missCheckResultPath, str);
					if (filePath) {
						vscode.workspace.openTextDocument(filePath).then((doc) => {
							vscode.window.showTextDocument(doc);

							// // 记录用户行为数据
							// reporter.sendTelemetryEvent("extension_du_i18n_missingDetection", {
							// 	action: "翻译漏检-成功",
							// });
						});
					}
				}
				// // 记录用户行为数据
				// reporter.sendTelemetryEvent("extension_du_i18n_missingDetection", {
				// 	action: "翻译漏检",
				// });
			})
		);

		// 监听命令-远程漏检文案
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.searchUntranslateText', 
			async function () {
				try {
					const activeEditor = vscode.window.activeTextEditor;
					if (activeEditor) {
						const { fileName } = activeEditor.document || {};
						if (deyi.isOnline()) {
							if (!deyi.checkProjectConfig()) {
								return null;
							}
							await deyi.getOnlineLanguage();
							// 多语言平台
							const defaultLang = deyi.getDefaultLang();
							const tempLangs = deyi.getTempLangs();
							const langKey = userKey || defaultLang;
							if (Array.isArray(tempLangs) && tempLangs.length) {
								const items = tempLangs.filter((k) => k && k !== langKey).map((k) => ({ label: k, value: k }));
								const selected = await vscode.window.showQuickPick(items, { placeHolder: '请选择目标语言' });
								if (selected) {
									const untransLangObj = await deyi.searchUntranslateText(langKey, selected.value);
									if (isEmpty(untransLangObj)) {
										throw new Error('数据异常');
									}
									const localFilePath = deyi.getLanguageMissOnlinePath();
									const filePath: any = await writeContentToLocalFile(fileName, localFilePath, untransLangObj);
									// 设置HTML内容
									if (filePath) {
										vscode.workspace.openTextDocument(filePath).then((doc) => {
											vscode.window.showTextDocument(doc);

											// // 记录用户行为数据
											// reporter.sendTelemetryEvent("extension_du_i18n_searchUntranslateText", {
											// 	action: "远程漏检文案-内部-操作成功",
											// });
										});
									}
								}
							}
							// // 记录用户行为数据
							// reporter.sendTelemetryEvent("extension_du_i18n_searchUntranslateText", {
							// 	action: "远程漏检文案-内部",
							// });
						} else {
							vscode.window.showWarningMessage(`请完善线上化相关配置`);
							deyi.openSetting(fileName, () => {});
							// // 记录用户行为数据
							// reporter.sendTelemetryEvent("extension_du_i18n_searchUntranslateText", {
							// 	action: "远程漏检文案-外部",
							// });
						}
					}
				} catch(e) {
					console.error(e);
					if (e.message) {
						vscode.window.showWarningMessage(e.message);
					}
					// // 记录用户行为数据
					// reporter.sendTelemetryEvent("extension_du_i18n_searchUntranslateText", {
					// 	action: "远程漏检文案-异常",
					// 	error: e,
					// });
				}
				// // 记录用户行为数据
				// reporter.sendTelemetryEvent("extension_du_i18n_searchUntranslateText", {
				// 	action: "远程漏检文案",
				// });
			})
		);

		// 监听命令-拆分语言文件
		context.subscriptions.push(vscode.commands.registerTextEditorCommand(
			'extension.du.i18n.generateLangFile', 
			async function () {
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor) {
					const { fileName } = activeEditor.document || {};
						// 更新本地语言
					await deyi.readLocalGlobalLangObj();
					// 拆分语言包
					const localLangObj = deyi.getLocalLangObj();
					const langPaths = deyi.getLangPaths();
					if (!langPaths) {return;}
					generateLangFile(langPaths, fileName, localLangObj, () => {
						vscode.window.showInformationMessage(`拆分成功`);

						// // 记录用户行为数据
						// reporter.sendTelemetryEvent("extension_du_i18n_generateLangFile", {
						// 	action: "拆分语言文件-拆分成功",
						// });
					});
				}
			})
		);

		// 在插件卸载时或使用完成后，断开与服务器的连接
		context.subscriptions.push({
			dispose() {
				// reporter.dispose();
			},
		});
	} catch(e) {
		console.error("du-i18n activate error", e);
	}
}

export function deactivate() {}
