const fetch = require('node-fetch').default;
const debounce = require('lodash/debounce');

const GET = async (url: any, params: any = {}) => {
  const apiUrl = Object.entries(params).filter(Boolean).reduce((pre, cur, i) => {
    let p = i === 0 ? '?' : '&';
    p += `${cur[0]}=${cur[1]}`;
    return pre + p;
  }, url);
  return fetch(apiUrl).then((res: any) => res.json());
};

const POST = async (url: any, params: any = {}, headers: any = {}) => {
  return fetch(url, {
    method: 'post',
    body: JSON.stringify(params),
    headers: {'Content-Type': 'application/json; charset=utf-8', ...headers}
  }).then((res: any) => res.json());
};

// 限流
const delayTime = 100;
const debouncedGet = debounce(GET, delayTime, {
  leading: true,
  trailing: false,
});
const debouncedPost = debounce(POST, delayTime, {
  leading: true,
  trailing: false,
});


export class API {
  /**
   * GET请求
   * @param url
   * @param params
   * @returns
   */
  static async GET(url: string, params: any, headers: any = {}) {
    console.log('GET', url, params);
    return debouncedGet(url, params, headers);
  }

  /**
   * POST请求
   * @param url
   * @param params
   * @returns
   */
  static async POST(url: string, params: any, headers: any = {}) {
    console.log('POST', url, params);
    return debouncedPost(url, params, headers);
  }
}