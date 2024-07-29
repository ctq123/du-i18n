/**
 * cache对象
 * 默认5M，初始化时可重置大小
 */
export class MapCache {
  private cache;
  private maxSize;
  constructor(props: any = {}) {
    this.cache = new Map();
    // 默认5M
    this.maxSize = (props && props.maxSize > 0) ? props.maxSize : 5 * 1024 * 1024; 
  }
  
  get(key: any) {
    return this.cache.get(key);
  }

  set(key: any, value: any) {
    const cacheKey = key;
    // 超出大小时，剔除第一个
    if (this.cache.size > this.maxSize) {
      const deleteKey = Array.from(this.cache.keys())[0];
      this.cache.delete(deleteKey);
    }
    this.cache.set(cacheKey, value);
  }

  delete(key: any) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

export default MapCache;