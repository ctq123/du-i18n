# 国际多语言本地开发解决方案
### 1. 介绍
![图片](https://cdn.poizon.com/node-common/a7ddb118-d9f0-99b2-968e-485c2610eed9-1149-932.png)
为本地开发工作提供敏捷的开发模式，提供一键扫描中文、提取文案、文案回显、在线翻译、文案上传、拉取线上文案、翻译漏检、切换语言以及分析统计等功能。i18n技术栈，兼容vue2，vue3，react，js/ts，同时满足不同阶段多语言发展的开发模式，无论是本地保存文案模式，还是线上保存文案模式皆可适用。

![图片](https://cdn.poizon.com/node-common/ec8d527c-aa61-fed3-6b0b-d35f4d59ff51-1944-1348.png)

### 2. 功能
- 支持文案回显
- 支持一键扫描中文
- 支持中文提取到指定文件
- 支持本地或远程在线翻译
- 支持文案上传到远程服务
- 支持拉取线上文案，定位文案的代码位置
- 支持翻译漏检功能
- 支持语言切换显示
- 支持分析统计
- 支持配置化，满足不同开发场景

### 3. 兼容性
- 开发模式：支持多种不同阶段多语言发展的开发模式，保存在本地的模式，保存在线上的模式；
- 技术栈：i18n，兼容vue2，vue3，react（含js和ts）

### 4. 使用
#### 1）配置
安装好之后，点击设置，自动生成配置文件du-i18n.config.json
![图片](https://cdn.poizon.com/node-common/84c24c99-275e-36af-6a7a-a9e49a653a7e-2340-1386.png)
![图片](https://cdn.poizon.com/node-common/ec8d527c-aa61-fed3-6b0b-d35f4d59ff51-1944-1348.png)


#### 2）文案回显
![图片](https://cdn.poizon.com/node-common/4fe4947e-fbe9-92ab-2758-8d471c87979c-1252-802.png)
i18n要先引入生成文件夹内容，可自主配置

#### 3）一键扫描中文
![图片](https://cdn.poizon.com/node-common/1ae89e81-c8eb-184d-48aa-e4f7a899bf6b-781-818.png)

![图片](https://cdn.poizon.com/node-common/3f37371a-fb0a-b5b0-ace9-6b34aaf8238b-1111-385.png)

![图片](https://cdn.poizon.com/node-common/db740cdb-c4ce-62f2-559b-77f7bd51c863-923-442.png)
在/src/i18n/temp/自动生成随机文件，路径和文件名都可以自主配置，生成随机文件名主要是解决代码冲突问题；当然也可生成一个固定的文件，自主配置即可

#### 4）线上翻译
分三种场景：

1）场景1：接入deyi，这种场景下，会直接调用deyi上该项目的已有的文案进行翻译；

2）场景2：没有接入deyi，创建本地翻译源文案/src/i18n/source/，会采用这里的翻译源进行翻译；

3）场景3：没有接入deyi，直接调用百度API在线翻译进行翻译，需要配置isOnlineTrans=true;

下面是直接调用百度API在线翻译的场景：
![图片](https://cdn.poizon.com/node-common/1c790419-8a15-6692-93bc-67906d01e088-1574-1028.png)
![图片](https://cdn.poizon.com/node-common/ad792b2d-174f-cc41-9b6a-cbe3ae3f3985-1038-906.png)
**理论上可以进行任意的语言转换（比如中文翻译英文，日语翻译韩语），只要切换默认语言即可，下面就以英文翻译其他语言为例，如图**
![图片](https://cdn.poizon.com/node-common/d04fae13-3783-a5b7-4a6d-daaae4f8b6fb-742-838.png)
![图片](https://cdn.poizon.com/node-common/2e790a70-f757-fdd6-9ef1-4e7a759a9554-1634-386.png)

**切换英文en，以英文翻译其他语言，如图**

![图片](https://cdn.poizon.com/node-common/d5ed53f8-317b-bb69-27b8-43a59371c4bd-1650-966.png)
![图片](https://cdn.poizon.com/node-common/e908bfc1-df7e-ebc3-ccd0-0f055af8cd1b-1190-656.png)
**更多的语言code请参考https://fanyi-api.baidu.com/doc/21**
在配置文件du-i18n.config.json中配置tempLangs扩展语言code即可。

#### 5）翻译漏检
主要用于检查翻译遗漏情况，哪些没有翻译的文案会检测出来
![图片](https://cdn.poizon.com/node-common/ea6f5cd1-aa85-2b0f-e962-24b7839de1fe-1894-1032.png)
![图片](https://cdn.poizon.com/node-common/7adfb8bf-24ec-82a5-845f-d78813601e01-1262-860.png)

#### 5）更多
其余大多属于内部线上化配置功能，这里不再过多介绍