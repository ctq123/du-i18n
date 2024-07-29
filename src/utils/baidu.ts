import * as API from './api';
import * as vscode from 'vscode';
const md5 = require('md5');

const url: string = 'http://api.fanyi.baidu.com/api/trans/vip/translate';
const appid: string = '20230122001537266';
const secrectKey: string = 'iSC0xuACrRDVLfUrDviL';
const salt: string = '1435660288';

const getSign = (q: string = '', baiduAppid: string = '', baiduSecrectKey: string = '') => {
  let str = '';
  if (baiduAppid && baiduSecrectKey) {
    str = baiduAppid + q + salt + baiduSecrectKey;
  } else {
    str = appid + q + salt + secrectKey;
  }
  return md5(str);
}

export const getTranslate = async (params: any = {}) => {
  const { baiduAppid, baiduSecrectKey } = params;
  const newParams = {
    from: 'zh',
    to: 'en',
    salt,
    appid: baiduAppid || appid,
    ...params,
    sign: getSign(params.q, baiduAppid, baiduSecrectKey),
  }
  newParams.q = encodeURIComponent(newParams.q);
  const data = await API.GET(url, newParams);
  if (data && data.error_code) {
    if (Number(data.error_code) === 54004 && (!baiduAppid || !baiduSecrectKey)) {
      vscode.window.showWarningMessage(`每月5w翻译数量限制的公共额度已用完，可开通百度翻译账号，并在du-i18n.config.json文件中设置自己的baiduAppid和baiduSecrectKey进行翻译`);
    } else {
      vscode.window.showWarningMessage(`百度翻译异常code：${data.error_code}，详情https://fanyi-api.baidu.com/doc/21`);
    }
  }
  return data;
};