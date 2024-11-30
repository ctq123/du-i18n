# 一、开发须知
### 1. node版本建议
```
v14.17.3
```
### 2. 源地址
```
https://registry.npmmirror.com
```


# 二、国际多语言本地开发解决方案
### 1. 介绍
![image](https://github.com/user-attachments/assets/f7057f15-bd23-484b-b6d0-62fa4cae5caa)
为本地开发工作提供敏捷的开发模式，提供一键扫描中文、提取文案、文案回显、在线翻译、文案上传、拉取线上文案、翻译漏检、切换语言以及分析统计等功能。i18n技术栈，兼容vue2，vue3，react，js/ts，同时满足不同阶段多语言发展的开发模式，无论是本地保存文案模式，还是线上保存文案模式皆可适用。

![image](https://github.com/user-attachments/assets/103bef41-b417-44bc-88ea-52a9ad8aa2af)

项目开源地址：https://github.com/ctq123/du-i18n

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
![image](https://github.com/user-attachments/assets/8afc8eb3-ccd7-41ea-861c-3f7b556b28e5)
![image](https://github.com/user-attachments/assets/45454211-daef-4561-81e0-fedadd386d9c)


#### 2）文案回显
![image](https://github.com/user-attachments/assets/34d7e291-874f-4830-a16e-3b69517e7c56)
i18n要先引入生成文件夹内容，可自主配置

#### 3）一键扫描中文
![image](https://github.com/user-attachments/assets/32abcb10-d224-4fbf-a74f-dcd8c7fd1193)

![image](https://github.com/user-attachments/assets/41f7adbd-d743-48ac-94e0-de68ee2699d2)

![image](https://github.com/user-attachments/assets/8335e5b4-8a98-4539-91ab-9ef647829047)

在/src/i18n/temp/自动生成随机文件，路径和文件名都可以自主配置，生成随机文件名主要是解决代码冲突问题；当然也可生成一个固定的文件，自主配置即可

#### 4）线上翻译
分三种场景：

1）场景1：接入deyi，这种场景下，会直接调用deyi上该项目的已有的文案进行翻译；

2）场景2：没有接入deyi，创建本地翻译源文案/src/i18n/source/，会采用这里的翻译源进行翻译；

3）场景3：没有接入deyi，直接调用百度API在线翻译进行翻译，需要配置isOnlineTrans=true;

下面是直接调用百度API在线翻译的场景：
![image](https://github.com/user-attachments/assets/3635fa17-8ab2-49ff-a529-27d69982869b)
![image](https://github.com/user-attachments/assets/0194f0f5-4a96-442d-8f0a-d008ac3140cc)
**理论上可以进行任意的语言转换（比如中文翻译英文，日语翻译韩语），只要切换默认语言即可，下面就以英文翻译其他语言为例，如图**
![image](https://github.com/user-attachments/assets/51f8d6ec-ea11-4a8d-be38-c7d452a0ad25)
![image](https://github.com/user-attachments/assets/08dba2ac-3840-48b5-a8bb-53dfa439b5d1)


**切换英文en，以英文翻译其他语言，如图**
![image](https://github.com/user-attachments/assets/143ed4da-92ae-4363-b512-976e0a702e04)
![image](https://github.com/user-attachments/assets/61282589-07eb-4c27-837e-b1cd9afe4c0f)

**更多的语言code请参考https://fanyi-api.baidu.com/doc/21**
在配置文件du-i18n.config.json中配置tempLangs扩展语言code即可。

#### 5）翻译漏检
主要用于检查翻译遗漏情况，哪些没有翻译的文案会检测出来
![image](https://github.com/user-attachments/assets/12b4cef8-a108-4567-a5c7-97763a703e12)
![image](https://github.com/user-attachments/assets/f5f8d861-8eee-4933-955f-cac7fb63a895)


#### 5）更多
其余大多属于内部线上化配置功能，这里不再过多介绍
