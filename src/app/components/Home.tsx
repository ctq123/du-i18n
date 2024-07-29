import * as React from 'react';
import { Input, Select, Button, Form, message } from 'antd';
import './Home.css';
import 'antd/lib/button/style/css';
import 'antd/lib/select/style/css';
import 'antd/lib/input/style/css';
import 'antd/lib/form/style/css';

const { Option } = Select;
const { TextArea } = Input;

const Home = (props: any) => {
  const { langs = ['zh'], defaultLang='zh', defaultFormat='json', handleCB } = props;
  const [ formats, setFormats ] = React.useState(['json', 'yaml']);
  const [ originText, setOriginText ] = React.useState();
  const [ translation, setTranslation ] = React.useState();
  const [ lastKeys, setLastKeys ] = React.useState([]);
  const [form] = Form.useForm();
  const defaultPrefix = defaultFormat === 'yaml' ? 'app' : 'app.home';

  React.useEffect(() => {
    if (form) {
      form.setFieldsValue({ langs, lang: defaultLang, format: defaultFormat, prefix: defaultPrefix });
    }
  }, [defaultLang]);

  const generateResult = (val: any) => {
    if (val) {
      const prefix = form.getFieldValue('prefix');
      const format = form.getFieldValue('format');
      const arr = val.split(/[\t\n]/g);
      const translation = arr.filter((c: any) => c && c.trim())
      .reduce((pre: any, cur: any, i: number) => {
        let key = prefix ? `${prefix}` : '';
        key += (format === 'json' ? `.` : '');
        key += lastKeys[i] || i;
        // json格式
        if (format === 'json') {
          pre += `"${key}": "${cur.trim()}"`;
          pre += ',';
        } else {
          pre += `${key}: ${cur.trim()}`;
        }
        pre += '\n';
        return pre;
      }, '');
      setTranslation(translation);
    } else {
      setTranslation(undefined);
    }
  }

  const handleTranslate = (e: any) => {
    const val = e.target.value || '';
    generateResult(val);
    setOriginText(val);
  }

  const handleResultChange = (e: any) => {
    const val = e.target.value;
    setTranslation(val);
    if (val) {
      const format = form.getFieldValue('format');
      let prefix = form.getFieldValue('prefix');
      prefix += prefix && format === 'json' ? '.' : '';
      let keyList: any = lastKeys || [];
      const arr = val.split(/[\n]/g);
      arr.filter((c: any) => c && c.trim()).forEach((item: any, i: number) => {
        const keys = item.split(':')[0];
        let key = keys.replace(prefix, '');
        key = key.replace(/["']/g, '');
        if (/\d/.test(key)) {
          keyList[i] = undefined;
        } else {
          keyList[i] = key;
        }
      });
      console.log("keyList", keyList);
      setLastKeys(keyList);
    }
  }

  const handleFormatChange = (e: any) => {
    generateResult(originText);
  }

  const confirm = () => {
    form.validateFields()
    .then((values: any) => {
      console.log("values", values);
      const data = {
        lang: values.lang,
        text: (translation || '').split('\n').join('\n'),
      }
      handleCB && handleCB(data);
    })
    .catch(() => {
      message.error('请选择目标语言');
    });
  };

  const before = `
  例如：
  App Store
  Google play`;
  const after = `
  结果：
  "app.home.apple": "App Store",
  "app.home.google": "Google play",`;

  return (
    <div className={'container'}>
      <div className='header'>
        <div className='title'>批量新增翻译</div>
      </div>
      <div className='mt16'>
        <Form
          name="basic"
          form={form}
          labelCol={{ span: 3 }}
          wrapperCol={{ span: 12 }}
          initialValues={{ lang: defaultLang, format: defaultFormat, prefix: defaultPrefix }}
        >
          <Form.Item
            label="目标语言"
            name="lang"
            rules={[{ required: true, message: '请选择目标语言' }]}
          >
            <Select
              placeholder="请选择目标语言"
              allowClear
            >
              {
                (langs || []).map((k: any) => <Option value={k}>{k}</Option>)
              }
            </Select>
          </Form.Item>

          <Form.Item
            label="生成格式"
            name="format"
            rules={[{ required: false, message: '请选择生成格式' }]}
          >
            <Select
              placeholder="请选择生成格式"
              allowClear
              onChange={handleFormatChange}
            >
              {
                formats.map((k: any) => <Option value={k}>{k}</Option>)
              }
            </Select>
          </Form.Item>

          <Form.Item
            label="编码前缀"
            name="prefix"
            rules={[{ required: false, message: '请输入编码前缀' }]}
          >
            <Input placeholder="请输入编码前缀" allowClear />
          </Form.Item>

          <Form.Item wrapperCol={{ offset: 3, span: 21 }}>
            {
              <div className={'df aic'}>
                <TextArea 
                  placeholder={before} 
                  onChange={handleTranslate}
                  rows={20}
                  allowClear
                />
                <span className='ml8 mr8 box'>{'>'}</span>
                <TextArea
                  placeholder={after}
                  rows={20}
                  onChange={handleResultChange}
                  value={translation}
                  allowClear
                />
              </div>
            }
          </Form.Item>

          <Form.Item wrapperCol={{ offset: 3, span: 21 }}>
            {
              // <Popconfirm
              //   title="该操作会在目标语言文件的尾部插入生成的结果，确认继续执行?"
              //   onConfirm={confirm}
              //   onCancel={() => {}}
              //   okText="确定"
              //   cancelText="取消"
              // >
                <Button type="primary" onClick={confirm}>
                  批量新增
                </Button>
              // </Popconfirm>
            }
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default Home;
