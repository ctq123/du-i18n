const fetch = require('node-fetch').default;

export const GET = async (url: any, params: any = {}) => {
  const apiUrl = Object.entries(params).filter(Boolean).reduce((pre, cur, i) => {
    let p = i === 0 ? '?' : '&';
    p += `${cur[0]}=${cur[1]}`;
    return pre + p;
  }, url);
  return fetch(apiUrl).then((res: any) => res.json());
};

export const POST = async (url: any, params: any = {}, headers: any = {}) => {
  return fetch(url, {
    method: 'post',
    body: JSON.stringify(params),
    headers: {'Content-Type': 'application/json; charset=utf-8', ...headers}
  }).then((res: any) => res.json());
};


export default {
  GET,
  POST,
};